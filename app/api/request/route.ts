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
      if (session.role === "ADMIN" && !["PRIMLJENO", "ZAVRSENO"].includes(targetStatus)) {
        return NextResponse.json({ ok: false, message: "Admin može da proknjiži ili arhivira trebovanje." }, { status: 403 });
      }
      if (session.role !== "ADMIN" && session.role !== "MAGACIONER") {
        return NextResponse.json({ ok: false, message: "Nedozvoljen pristup." }, { status: 403 });
      }

      let data: any = null;

      // ADMIN "PROKNJIŽI": ne završavamo zahtev odmah. Umesto toga pravimo
      // TS Market movement-e u tačno definisanom outbox-u. TS Market ih preuzima
      // preko /api/integrations/ts-market/v1/movements i potvrđuje preko
      // /acknowledgements. Tek kada SVE stavke dobiju POSTED, zahtev prelazi u PRIMLJENO.
      if (targetStatus === "PRIMLJENO") {
        const requestId = String(b.request_id || "");
        const { data: doc, error: docErr } = await admin
          .from("cm_documents")
          .select("id,status,type,destination_location_id,created_at")
          .eq("id", requestId)
          .eq("type", "TREBOVANJE")
          .single();
        if (docErr) throw docErr;
        const currentStatus = String(doc?.status || "").toUpperCase();
        if (currentStatus === "PRIMLJENO" || currentStatus === "ZAVRSENO") {
          return NextResponse.json({ ok: true, data: doc, status: currentStatus, ts_market_pending: false });
        }
        if (currentStatus !== "POSLATO" && currentStatus !== "POSLATO_TS") {
          return NextResponse.json({ ok: false, message: "Trebovanje još nije potvrđeno od magacionera." }, { status: 400 });
        }

        const [{ data: dest, error: destErr }, { data: rows, error: rowsErr }] = await Promise.all([
          admin.from("cm_locations").select("id,code,name,ts_market_warehouse_code").eq("id", doc.destination_location_id).single(),
          admin.from("cm_document_lines")
            .select("id,article_id,sifra,naziv,jm,qty")
            .eq("document_id", requestId)
            .gt("qty", 0),
        ]);
        if (destErr) throw destErr;
        if (rowsErr) throw rowsErr;
        if (!rows?.length) throw new Error("Trebovanje nema stavke za TS Market.");

        const now = new Date().toISOString();
        const tsCode = String(dest?.ts_market_warehouse_code || "TO_MAP");
        const movements = rows.map((line: any) => ({
          movement_id: `cm-${String(line.id)}`,
          revision: 1,
          occurred_at: now,
          pili_store_code: String(dest?.code || ""),
          ts_market_warehouse_code: tsCode,
          kind: "WAREHOUSE_TRANSFER",
          pili_article_id: String(line.article_id),
          pili_sifra: String(line.sifra || ""),
          item_name: String(line.naziv || ""),
          unit: String(line.jm || "KOM"),
          quantity: Number(line.qty || 0),
          from_warehouse_code: "20",
          to_warehouse_code: tsCode,
          source_record_id: requestId,
          test: false,
          status: "READY",
          updated_at: now,
        }));

        // Idempotentno: isti movement_id + revision ne može duplo da se knjiži.
        for (const movement of movements) {
          const { data: existing, error: existingErr } = await admin
            .from("ts_market_movements")
            .select("movement_id,status")
            .eq("movement_id", movement.movement_id)
            .eq("revision", movement.revision)
            .maybeSingle();
          if (existingErr) throw existingErr;
          // POSTED nikad ne vraćamo u READY. REJECTED se može ponovo poslati istim id-em.
          if (String(existing?.status || "").toUpperCase() === "POSTED") continue;
          const { error: upErr } = await admin
            .from("ts_market_movements")
            .upsert(movement, { onConflict: "movement_id,revision" });
          if (upErr) throw upErr;
        }

        const { data: queued, error: queueErr } = await admin
          .from("cm_documents")
          .update({ status: "POSLATO_TS", updated_at: now, created_by: session.id })
          .eq("id", requestId)
          .eq("type", "TREBOVANJE")
          .select("id,status")
          .single();
        if (queueErr) throw queueErr;
        data = queued;

        const { data: central, error: centralErr } = await admin.from("cm_locations")
          .select("id").eq("type", "CENTRAL").limit(1).single();
        if (centralErr || !central?.id) throw centralErr || new Error("Centralni magacin nije pronađen.");
        await reconcileCentralStock(admin, String(central.id));

        return NextResponse.json({
          ok: true,
          data,
          status: "POSLATO_TS",
          ts_market_pending: true,
          message: "Trebovanje je poslato TS Marketu i čeka potvrdu knjiženja.",
        });
      }

      if (targetStatus === "ZAVRSENO") {
        const { data: archived, error } = await admin
          .from("cm_documents")
          .update({ status: "ZAVRSENO", updated_at: new Date().toISOString(), created_by: session.id })
          .eq("id", b.request_id)
          .eq("type", "TREBOVANJE")
          .eq("status", "PRIMLJENO")
          .select("id,status")
          .single();
        if (error) throw error;
        data = archived;
      } else {
        const { data: changed, error } = await admin.rpc("cm_set_request_status", {
          p_request_id: b.request_id,
          p_status: targetStatus,
          p_user_id: session.id,
        });
        if (error) throw error;
        data = changed;
      }
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
      if (["POSLATO", "POSLATO_TS", "PRIMLJENO", "ZAVRSENO"].includes(String(doc.status || "").toUpperCase())) {
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

      // Pakovanje ne knjiži robu: za knjiženje je potrebna potvrda ADMINA.
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

    // Radnja samo šalje trebovanje.
    // Centralno stanje se NE menja u ovom trenutku.
    // Skidanje se radi tek kada magacioner potvrdi pakovanje.
    return NextResponse.json({
      ok: true,
      data,
      location: location.name,
      requested_by: session.full_name,
      stock_updated: false,
      rule: "STANJE SE SKIDA TEK POSLE POTVRDE MAGACIONERA",
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
