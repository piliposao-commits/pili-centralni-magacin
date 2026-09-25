import { admin } from "@/lib/server";

const INITIAL_DOC_NO = "POCETNO_STANJE";
const INITIAL_SUPPLIER = "SISTEM_POCETNO_STANJE";

type SnapshotRow = {
  article_id: string;
  qty: number;
};

async function getOrCreateMarker(centralId: string, userId?: string | null) {
  let { data: marker, error } = await admin
    .from("cm_documents")
    .select("id")
    .eq("type", "ULAZ")
    .eq("document_no", INITIAL_DOC_NO)
    .eq("supplier", INITIAL_SUPPLIER)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (!marker?.id) {
    const { data: created, error: createErr } = await admin
      .from("cm_documents")
      .insert({
        type: "ULAZ",
        status: "ZAVRSENO",
        destination_location_id: centralId,
        document_no: INITIAL_DOC_NO,
        supplier: INITIAL_SUPPLIER,
        created_by: userId || null,
      })
      .select("id")
      .single();
    if (createErr) throw createErr;
    marker = created;
  }

  return marker.id as string;
}

export async function ensureInitialStockSnapshot(
  centralId: string,
  rows: SnapshotRow[],
  userId?: string | null
) {
  if (!rows.length) return;
  const markerId = await getOrCreateMarker(centralId, userId);
  const ids = [...new Set(rows.map((x) => String(x.article_id)).filter(Boolean))];
  if (!ids.length) return;

  const { data: existing, error: existingErr } = await admin
    .from("cm_document_lines")
    .select("article_id")
    .eq("document_id", markerId)
    .in("article_id", ids);
  if (existingErr) throw existingErr;

  const already = new Set((existing || []).map((x: any) => String(x.article_id)));
  const missing = rows.filter((x) => x.article_id && !already.has(String(x.article_id)));
  if (!missing.length) return;

  const { data: articles, error: artErr } = await admin
    .from("cm_articles")
    .select("id,sifra,naziv,barkod,jm,maloprodajna_cena")
    .in("id", missing.map((x) => x.article_id));
  if (artErr) throw artErr;

  const qtyMap = new Map(missing.map((x) => [String(x.article_id), Number(x.qty || 0)]));
  const lines = (articles || []).map((a: any) => ({
    document_id: markerId,
    article_id: a.id,
    sifra: a.sifra,
    naziv: a.naziv,
    barkod: a.barkod,
    jm: a.jm,
    qty: Number(qtyMap.get(String(a.id)) || 0),
    price: Number(a.maloprodajna_cena || 0),
  }));

  if (lines.length) {
    const { error: insertErr } = await admin.from("cm_document_lines").insert(lines);
    if (insertErr) throw insertErr;
  }
}

export async function saveInitialStockValue(
  centralId: string,
  articleId: string,
  qty: number,
  userId?: string | null
) {
  const markerId = await getOrCreateMarker(centralId, userId);
  const { data: article, error: articleErr } = await admin
    .from("cm_articles")
    .select("id,sifra,naziv,barkod,jm,maloprodajna_cena")
    .eq("id", articleId)
    .single();
  if (articleErr || !article) throw articleErr || new Error("Artikal nije pronađen.");

  const { error: deleteErr } = await admin
    .from("cm_document_lines")
    .delete()
    .eq("document_id", markerId)
    .eq("article_id", articleId);
  if (deleteErr) throw deleteErr;

  const { error: lineErr } = await admin.from("cm_document_lines").insert({
    document_id: markerId,
    article_id: article.id,
    sifra: article.sifra,
    naziv: article.naziv,
    barkod: article.barkod,
    jm: article.jm,
    qty,
    price: Number(article.maloprodajna_cena || 0),
  });
  if (lineErr) throw lineErr;
}
