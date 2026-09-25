import { admin } from "@/lib/server";

const INITIAL_DOC_NO = "POCETNO_STANJE";
const INITIAL_SUPPLIER = "SISTEM_POCETNO_STANJE";
const REPAIR_DOC_NO = "POCETNO_STANJE_REPAIR_V3_2026_09_25";
const REPAIR_SUPPLIER = "SISTEM_POCETNO_REPAIR";

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

// Čuva početno stanje kao poseban istorijski zapis.
// NIKADA ne menja cm_stock (trenutno stanje).
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

// Jednokratna popravka za postojeće podatke.
// Ranija verzija aplikacije je prikazivala trenutno stanje kao početno kada zapis nije postojao.
// Pravo početno stanje možemo rekonstruisati iz istorije:
//   početno = trenutno - svi ULAZI + svi PRENOSI iz centralnog magacina.
// Nakon popravke upisujemo marker i više nikad automatski ne preračunavamo početno stanje.
export async function repairInitialStockFromHistory(centralId: string, userId?: string | null) {
  const { data: alreadyRepaired, error: repairCheckErr } = await admin
    .from("cm_documents")
    .select("id")
    .eq("type", "ULAZ")
    .eq("document_no", REPAIR_DOC_NO)
    .eq("supplier", REPAIR_SUPPLIER)
    .limit(1)
    .maybeSingle();
  if (repairCheckErr) throw repairCheckErr;
  if (alreadyRepaired?.id) return;

  const markerId = await getOrCreateMarker(centralId, userId);

  const [stockRes, articlesRes, inboundDocsRes, transferDocsRes] = await Promise.all([
    admin.from("cm_stock").select("article_id,qty").eq("location_id", centralId),
    admin.from("cm_articles").select("id,sifra,naziv,barkod,jm,maloprodajna_cena").eq("active", true),
    admin
      .from("cm_documents")
      .select("id,document_no,supplier,cm_document_lines(article_id,qty)")
      .eq("type", "ULAZ")
      .eq("destination_location_id", centralId),
    admin
      .from("cm_documents")
      .select("id,cm_document_lines(article_id,qty)")
      .eq("type", "PRENOS")
      .eq("source_location_id", centralId),
  ]);

  if (stockRes.error) throw stockRes.error;
  if (articlesRes.error) throw articlesRes.error;
  if (inboundDocsRes.error) throw inboundDocsRes.error;
  if (transferDocsRes.error) throw transferDocsRes.error;

  const current = new Map<string, number>();
  for (const row of stockRes.data || []) current.set(String(row.article_id), Number(row.qty || 0));

  const inbound = new Map<string, number>();
  for (const doc of inboundDocsRes.data || []) {
    if (doc.document_no === INITIAL_DOC_NO && doc.supplier === INITIAL_SUPPLIER) continue;
    if (doc.document_no === REPAIR_DOC_NO && doc.supplier === REPAIR_SUPPLIER) continue;
    for (const line of (doc as any).cm_document_lines || []) {
      const id = String(line.article_id);
      inbound.set(id, Number(inbound.get(id) || 0) + Number(line.qty || 0));
    }
  }

  const outbound = new Map<string, number>();
  for (const doc of transferDocsRes.data || []) {
    for (const line of (doc as any).cm_document_lines || []) {
      const id = String(line.article_id);
      outbound.set(id, Number(outbound.get(id) || 0) + Number(line.qty || 0));
    }
  }

  // Potpuno obnovi samo istorijski marker početnog stanja.
  const { error: deleteErr } = await admin
    .from("cm_document_lines")
    .delete()
    .eq("document_id", markerId);
  if (deleteErr) throw deleteErr;

  const lines = (articlesRes.data || []).map((a: any) => {
    const id = String(a.id);
    const calculated = Number(current.get(id) || 0) - Number(inbound.get(id) || 0) + Number(outbound.get(id) || 0);
    return {
      document_id: markerId,
      article_id: a.id,
      sifra: a.sifra,
      naziv: a.naziv,
      barkod: a.barkod,
      jm: a.jm,
      qty: Math.max(0, calculated),
      price: Number(a.maloprodajna_cena || 0),
    };
  });

  if (lines.length) {
    const { error: insertErr } = await admin.from("cm_document_lines").insert(lines);
    if (insertErr) throw insertErr;
  }

  const { error: markerErr } = await admin.from("cm_documents").insert({
    type: "ULAZ",
    status: "ZAVRSENO",
    destination_location_id: centralId,
    document_no: REPAIR_DOC_NO,
    supplier: REPAIR_SUPPLIER,
    created_by: userId || null,
  });
  if (markerErr) throw markerErr;
}
