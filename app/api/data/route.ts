import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
import { ensureOneTimeCleanStart } from "@/lib/cleanStart";
import { repairInitialStockFromHistory } from "@/lib/initialStock";

const BUCKET = "cm-article-images";

async function articleImageMap() {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!(buckets || []).some((b: any) => b.name === BUCKET)) return new Map<string, string>();
    const { data: files, error } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
    if (error) return new Map<string, string>();
    const m = new Map<string, string>();
    for (const f of files || []) {
      if (!f?.name) continue;
      const { data } = admin.storage.from(BUCKET).getPublicUrl(f.name);
      m.set(f.name, data.publicUrl);
    }
    return m;
  } catch {
    return new Map<string, string>();
  }
}

export async function GET() {
  try {
    const s = await requireSession();
    if (s.role !== "ADMIN" && s.role !== "MAGACIONER") return NextResponse.json({ ok: false, message: "Nedozvoljen pristup." }, { status: 403 });
    await ensureOneTimeCleanStart();

    const { data: central, error: centralErr } = await admin
      .from("cm_locations")
      .select("id")
      .eq("type", "CENTRAL")
      .limit(1)
      .single();
    if (centralErr || !central?.id) throw centralErr || new Error("Centralni magacin nije pronađen.");

    // Jednom vraća originalna početna stanja iz istorije kretanja, pa ih trajno zaključava.
    await repairInitialStockFromHistory(central.id, s.id);

    const [{ data: locations }, { data: stock }, { data: reqs }, { data: initialDocs }, images] = await Promise.all([
      admin.from("cm_locations").select("id,code,name,type").eq("active", true).order("name"),
      admin.from("cm_stock_view").select("*").order("naziv"),
      admin.from("cm_requests_view").select("*").order("created_at", { ascending: false }).limit(100),
      admin
        .from("cm_documents")
        .select("id,cm_document_lines(article_id,qty)")
        .eq("type", "ULAZ")
        .eq("document_no", "POCETNO_STANJE")
        .eq("supplier", "SISTEM_POCETNO_STANJE")
        .order("created_at", { ascending: false })
        .limit(1),
      articleImageMap(),
    ]);

    const initialMap = new Map<string, number>();
    const marker: any = (initialDocs || [])[0];
    for (const line of marker?.cm_document_lines || []) {
      initialMap.set(String(line.article_id), Number(line.qty || 0));
    }

    const safeStock = (stock || []).map((x: any) => {
      const current = Number(x.stanje || 0);
      const row = {
        ...x,
        image_url: images.get(String(x.article_id)) || null,
        initial_qty: initialMap.has(String(x.article_id)) ? initialMap.get(String(x.article_id)) : 0,
        initial_locked: initialMap.has(String(x.article_id)),
      };
      return s.role === "ADMIN" ? row : { ...row, maloprodajna_cena: undefined, vrednost: undefined };
    });

    return NextResponse.json({ ok: true, user: s, locations, stock: safeStock, requests: reqs || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
