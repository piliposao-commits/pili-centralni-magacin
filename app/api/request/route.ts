import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
import { reconcileCentralStock } from "@/lib/centralStock";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const session = await requireSession();

    if (b.action === "status") {
      const targetStatus = String(b.status || "").toUpperCase();

      if (session.role === "MAGACIONER" && !["U PRIPREMI", "POSLATO"].includes(targetStatus)) {
        return NextResponse.json({ ok: false, message: "Magacioner ne može da postavi taj status." }, { status: 403 });
      }
      if (session.role === "ADMIN" && targetStatus !== "PRIMLJENO") {
        return NextResponse.json({ ok: false, message: "Admin može samo da proknjiži trebovanje." }, { status: 403 });
      }
      if (session.role !== "ADMIN" && session.role !== "MAGACIONER") {
        return NextResponse.json({ ok: false, message: "Nedozvoljen pristup." }, { status: 403 });
      }

      const { data, error } = await admin.rpc("cm_set_request_status", {
        p_request_id: b.request_id,
        p_status: targetStatus,
        p_user_id: session.id,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, data, status: targetStatus });
    }

    if (b.action === "pack") {
      if (session.role !== "MAGACIONER") {
        return NextResponse.json({ ok: false, message: "Samo magacioner može da potvrdi pakovanje." }, { status: 403 });
      }

      const requestId = String(b.request_id || "");
      const packedLines = Array.isArray(b.lines)
        ? b.lines
            .map((x: any) => ({ article_id: String(x.article_id || ""), qty: Number(x.qty || 0) }))
            .filter((x: any) => x.article_id && Number.isFinite(x.qty) && x.qty >= 0)
        : [];

      if (!requestId || !packedLines.length) {
        return NextResponse.json({ ok: false, message: "Nedostaje trebovanje ili spakovane stavke." }, { status: 400 });
      }

      const { data: doc, error: docErr } = await admin
        .from("cm_documents")
        .select("id,status,type")
        .eq("id", requestId)
        .eq("type", "TREBOVANJE")
        .single();
      if (docErr) throw docErr;
      if (["POSLATO", "PRIMLJENO"].includes(String(doc.status || "").toUpperCase())) {
        return NextResponse.json({ ok: false, message: "Trebovanje je već potvrđeno." }, { status: 400 });
      }

      for (const line of packedLines) {
        const { error: lineErr } = await admin
          .from("cm_document_lines")
          .update({ qty: line.qty })
          .eq("document_id", requestId)
          .eq("article_id", line.article_id);
        if (lineErr) throw lineErr;
      }

      const { error: statusErr } = await admin
        .from("cm_documents")
        .update({ status: "POSLATO", updated_at: new Date().toISOString(), created_by: session.id })
        .eq("id", requestId)
        .eq("type", "TREBOVANJE");
      if (statusErr) throw statusErr;

      const { data: central, error: centralErr } = await admin
        .from("cm_locations")
        .select("id")
        .eq("type", "CENTRAL")
        .limit(1)
        .single();
      if (centralErr || !central?.id) throw centralErr || new Error("Centralni magacin nije pronađen.");
      await reconcileCentralStock(admin, String(central.id));

      return NextResponse.json({ ok: true, status: "POSLATO" });
    }

    if (session.role !== "PRODAVNICA") {
      return NextResponse.json({ ok: false, message: "Samo korisnik prodavnice može da pošalje trebovanje." }, { status: 403 });
    }

    if (!session.location_code) {
      return NextResponse.json(
        { ok: false, message: "Korisnik nije vezan za prodavnicu." },
        { status: 403 }
      );
    }

    const { data: location, error: locErr } = await admin
      .from("cm_locations")
      .select("id,code,name")
      .eq("code", session.location_code)
      .eq("active", true)
      .single();

    if (locErr || !location) {
      return NextResponse.json(
        { ok: false, message: "Prodavnica korisnika nije pronađena." },
        { status: 404 }
      );
    }

    const lines = Array.isArray(b.lines)
      ? b.lines
          .map((x: any) => ({ article_id: String(x.article_id || ""), qty: Number(x.qty || 0) }))
          .filter((x: any) => x.article_id && x.qty > 0)
      : [];

    if (!lines.length) {
      return NextResponse.json({ ok: false, message: "Nema stavki za trebovanje." }, { status: 400 });
    }

    const { data, error } = await admin.rpc("cm_create_request", {
      p_location_id: location.id,
      p_requested_by: session.full_name,
      p_lines: lines,
    });
    if (error) throw error;

    // Čim je trebovanje kreirano, odmah se skida/rezerviše količina iz centralnog stanja.
    const { data: central, error: centralErr } = await admin
      .from("cm_locations")
      .select("id")
      .eq("type", "CENTRAL")
      .limit(1)
      .single();

    if (centralErr || !central?.id) {
      throw centralErr || new Error("Centralni magacin nije pronađen.");
    }

    await reconcileCentralStock(admin, String(central.id));

    return NextResponse.json({
      ok: true,
      data,
      location: location.name,
      requested_by: session.full_name,
      stock_updated: true,
      rule: "ULAZ - SVA AKTIVNA TREBOVANJA",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e.message || "Greška" },
      { status: e.message === "UNAUTHORIZED" ? 401 : 400 }
    );
  }
}

export async function GET() {
  try {
    const s = await requireSession();
    if (s.role !== "ADMIN" && s.role !== "MAGACIONER") {
      return NextResponse.json({ ok: false, message: "Nedozvoljen pristup." }, { status: 403 });
    }
    const { data, error } = await admin
      .from("cm_requests_view")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, requests: data || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 401 });
  }
}
