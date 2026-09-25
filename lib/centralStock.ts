export type StockLedger = {
  inboundMap: Map<string, number>;
  outboundMap: Map<string, number>;
  calculatedMap: Map<string, number>;
};

export async function reconcileCentralStock(admin: any, centralId: string): Promise<StockLedger> {
  const [{ data: docs, error: docsErr }, { data: articles, error: articlesErr }] = await Promise.all([
    admin
      .from("cm_documents")
      .select("id,type,status,source_location_id,destination_location_id,document_no,supplier,created_at,cm_document_lines(article_id,qty)")
      .in("type", ["ULAZ", "PRENOS", "TREBOVANJE"]),
    admin.from("cm_articles").select("id").eq("active", true),
  ]);
  if (docsErr) throw docsErr;
  if (articlesErr) throw articlesErr;

  const inboundMap = new Map<string, number>();
  const outboundMap = new Map<string, number>();

  // POPRAVKA STARE ISTORIJE:
  // Ako je ranije stvarni PRENOS već proknjižen, a zahtev je zbog stare logike
  // ostao "U PRIPREMI", pronađi isti zahtev po odredištu + identičnim stavkama
  // i označi ga kao POSLATO. Ovo ne knjiži robu ponovo; samo ispravlja status.
  const transfers = (docs || []).filter((d: any) =>
    String(d?.type || "").toUpperCase() === "PRENOS" &&
    ["POSLATO", "PRIMLJENO", "ZAVRSENO"].includes(String(d?.status || "").toUpperCase()) &&
    String(d?.source_location_id || "") === String(centralId)
  );

  const lineSignature = (d: any) => {
    const lines = Array.isArray(d?.cm_document_lines) ? d.cm_document_lines : [];
    return lines
      .map((x: any) => `${String(x?.article_id || "")}:${Number(x?.qty || 0)}`)
      .filter(Boolean)
      .sort()
      .join("|");
  };

  for (const req of (docs || []).filter((d: any) =>
    String(d?.type || "").toUpperCase() === "TREBOVANJE" &&
    String(d?.status || "").toUpperCase() === "U PRIPREMI"
  )) {
    const reqSig = lineSignature(req);
    if (!reqSig) continue;
    const reqTime = new Date(req.created_at || 0).getTime();
    const matchingTransfer = transfers.find((t: any) => {
      if (String(t?.destination_location_id || "") !== String(req?.destination_location_id || "")) return false;
      if (lineSignature(t) !== reqSig) return false;
      const transferTime = new Date(t.created_at || 0).getTime();
      return transferTime >= reqTime && transferTime - reqTime <= 24 * 60 * 60 * 1000;
    });
    if (matchingTransfer) {
      const { error: repairErr } = await admin
        .from("cm_documents")
        .update({ status: "POSLATO", updated_at: new Date().toISOString() })
        .eq("id", req.id)
        .eq("type", "TREBOVANJE")
        .eq("status", "U PRIPREMI");
      if (repairErr) throw repairErr;
      req.status = "POSLATO";
    }
  }

  // Završeni PRENOSI su primarni dokaz da je roba stvarno spakovana/izdata.
  const finalTransfers = (docs || []).filter((d: any) => {
    const type = String(d?.type || "").toUpperCase();
    const status = String(d?.status || "").toUpperCase();
    return (
      type === "PRENOS" &&
      ["POSLATO", "PRIMLJENO", "ZAVRSENO"].includes(status) &&
      String(d?.source_location_id || "") === String(centralId)
    );
  });

  // Pomoćna funkcija da prepoznamo da li finalizovano trebovanje već ima svoj PRENOS.
  const hasMatchingTransfer = (req: any) => {
    const reqSig = lineSignature(req);
    if (!reqSig) return false;
    const reqTime = new Date(req?.created_at || 0).getTime();

    return finalTransfers.some((t: any) => {
      if (String(t?.destination_location_id || "") !== String(req?.destination_location_id || "")) return false;
      if (lineSignature(t) !== reqSig) return false;
      const transferTime = new Date(t?.created_at || 0).getTime();

      // Transfer nastaje posle trebovanja. Dajemo dovoljno širok prozor i za staru istoriju.
      return transferTime >= reqTime && transferTime - reqTime <= 7 * 24 * 60 * 60 * 1000;
    });
  };

  for (const d of docs || []) {
    const type = String(d?.type || "").toUpperCase();
    const status = String(d?.status || "").toUpperCase();
    const lines = Array.isArray(d?.cm_document_lines) ? d.cm_document_lines : [];

    // Početno stanje sistema je 0. Završeni ULAZI u CENTRALNI MAGACIN povećavaju stanje.
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

    // Primarno: svaki završeni PRENOS iz centralnog magacina se oduzima.
    if (
      type === "PRENOS" &&
      ["POSLATO", "PRIMLJENO", "ZAVRSENO"].includes(status) &&
      String(d?.source_location_id || "") === String(centralId)
    ) {
      for (const line of lines) {
        const id = String(line?.article_id || "");
        if (!id) continue;
        outboundMap.set(id, Number(outboundMap.get(id) || 0) + Number(line?.qty || 0));
      }
    }
  }

  // BACKFILL STARE ISTORIJE:
  // Ako je staro trebovanje ručno označeno kao prihvaćeno/završeno, ali u staroj verziji
  // nije nastao PRENOS dokument, njegove stavke se ipak računaju kao izlaz.
  // Ako PRENOS postoji, ovaj fallback se NE koristi i nema duplog oduzimanja.
  for (const req of (docs || []).filter((d: any) => {
    const type = String(d?.type || "").toUpperCase();
    const status = String(d?.status || "").toUpperCase();
    return type === "TREBOVANJE" && ["POSLATO", "PRIMLJENO", "ZAVRSENO"].includes(status);
  })) {
    if (hasMatchingTransfer(req)) continue;

    const lines = Array.isArray(req?.cm_document_lines) ? req.cm_document_lines : [];
    for (const line of lines) {
      const id = String(line?.article_id || "");
      if (!id) continue;
      outboundMap.set(id, Number(outboundMap.get(id) || 0) + Number(line?.qty || 0));
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
