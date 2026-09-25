export type StockLedger = {
  inboundMap: Map<string, number>;
  outboundMap: Map<string, number>;
  calculatedMap: Map<string, number>;
};

export async function reconcileCentralStock(admin: any, centralId: string): Promise<StockLedger> {
  const [{ data: docs, error: docsErr }, { data: articles, error: articlesErr }] = await Promise.all([
    admin
      .from("cm_documents")
      .select("id,type,status,destination_location_id,document_no,supplier,cm_document_lines(article_id,qty)")
      .in("type", ["ULAZ", "TREBOVANJE"]),
    admin.from("cm_articles").select("id").eq("active", true),
  ]);
  if (docsErr) throw docsErr;
  if (articlesErr) throw articlesErr;

  const inboundMap = new Map<string, number>();
  const outboundMap = new Map<string, number>();

  for (const d of docs || []) {
    const type = String(d?.type || "").toUpperCase();
    const status = String(d?.status || "").toUpperCase();
    const lines = Array.isArray(d?.cm_document_lines) ? d.cm_document_lines : [];

    // Svaki pravi ulaz u centralni magacin povećava stanje.
    if (
      type === "ULAZ" &&
      status === "ZAVRSENO" &&
      String(d?.destination_location_id || "") === String(centralId) &&
      String(d?.document_no || "") !== "POCETNO_STANJE" &&
      String(d?.supplier || "") !== "SISTEM_POCETNO_STANJE"
    ) {
      for (const line of lines) {
        const id = String(line?.article_id || "");
        if (!id) continue;
        inboundMap.set(id, Number(inboundMap.get(id) || 0) + Number(line?.qty || 0));
      }
    }

    // KLJUČNO PRAVILO: trebovanje se oduzima tek kada ga magacioner završi/spakuje.
    // Stari završeni zahtevi se računaju isto kao novi, pa se istorija automatski preračunava.
    if (
      type === "TREBOVANJE" &&
      ["POSLATO", "PRIMLJENO", "ZAVRSENO"].includes(status)
    ) {
      for (const line of lines) {
        const id = String(line?.article_id || "");
        if (!id) continue;
        outboundMap.set(id, Number(outboundMap.get(id) || 0) + Number(line?.qty || 0));
      }
    }
  }

  const calculatedMap = new Map<string, number>();
  const rows = (articles || []).map((a: any) => {
    const id = String(a.id);
    const inbound = Number(inboundMap.get(id) || 0);
    const outbound = Number(outboundMap.get(id) || 0);
    const qty = Math.max(0, inbound - outbound);
    calculatedMap.set(id, qty);
    return {
      location_id: centralId,
      article_id: id,
      qty,
      updated_at: new Date().toISOString(),
    };
  });

  if (rows.length) {
    const { error: syncErr } = await admin
      .from("cm_stock")
      .upsert(rows, { onConflict: "location_id,article_id" });
    if (syncErr) throw syncErr;
  }

  return { inboundMap, outboundMap, calculatedMap };
}
