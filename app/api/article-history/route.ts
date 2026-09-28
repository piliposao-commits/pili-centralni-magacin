import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";

export async function GET(req: Request) {
  try {
    await requireSession("ADMIN");
    const url = new URL(req.url);
    const articleId = String(url.searchParams.get("article_id") || "");
    if (!articleId) {
      return NextResponse.json({ ok: false, message: "Nedostaje artikal." }, { status: 400 });
    }

    const [{ data: article, error: articleErr }, { data: lines, error: linesErr }, { data: counts, error: countsErr }] = await Promise.all([
      admin.from("cm_articles").select("id,sifra,naziv,barkod,jm").eq("id", articleId).single(),
      admin
        .from("cm_document_lines")
        .select("qty,document_id,cm_documents!inner(id,type,status,created_at,document_no,supplier,requested_by,destination_location_id)")
        .eq("article_id", articleId),
      admin
        .from("cm_inventory_history")
        .select("id,qty,counted_by,created_at")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false }),
    ]);

    if (articleErr) throw articleErr;
    if (linesErr) throw linesErr;
    if (countsErr) throw countsErr;

    const destinationIds = [...new Set((lines || [])
      .map((row: any) => row?.cm_documents?.destination_location_id)
      .filter(Boolean)
      .map(String))];

    const locationMap = new Map<string, string>();
    if (destinationIds.length) {
      const { data: locations, error: locErr } = await admin
        .from("cm_locations")
        .select("id,name")
        .in("id", destinationIds);
      if (locErr) throw locErr;
      for (const l of locations || []) locationMap.set(String(l.id), String(l.name || ""));
    }

    const events: any[] = [];
    for (const row of lines || []) {
      const d: any = row.cm_documents;
      if (!d) continue;
      const type = String(d.type || "").toUpperCase();
      const destinationName = d.destination_location_id
        ? (locationMap.get(String(d.destination_location_id)) || "Prodavnica")
        : "";

      if (type === "ULAZ") {
        events.push({
          kind: "ULAZ",
          created_at: d.created_at,
          qty: Number(row.qty || 0),
          delta: Number(row.qty || 0),
          detail: d.supplier || d.document_no || "Ulaz robe",
          status: d.status,
        });
      } else if (type === "TREBOVANJE") {
        events.push({
          kind: "TREBOVANJE",
          created_at: d.created_at,
          qty: Number(row.qty || 0),
          delta: -Number(row.qty || 0),
          detail: `${destinationName || "Prodavnica"}${d.requested_by ? " · " + d.requested_by : ""}`,
          status: d.status,
        });
      } else if (type === "PRENOS") {
        events.push({
          kind: "PRENOS",
          created_at: d.created_at,
          qty: Number(row.qty || 0),
          delta: -Number(row.qty || 0),
          detail: destinationName || "Prenos",
          status: d.status,
        });
      }
    }

    for (const c of counts || []) {
      events.push({
        kind: "POPIS",
        created_at: c.created_at,
        qty: Number(c.qty || 0),
        delta: null,
        detail: c.counted_by || "Admin",
        status: "POPIS",
      });
    }

    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ ok: true, article, events });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message || "Greška pri učitavanju istorije." },
      { status: e?.message === "UNAUTHORIZED" ? 401 : 400 }
    );
  }
}
