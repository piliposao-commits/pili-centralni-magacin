const BOOKED_REQUEST_STATUSES = new Set(["POSLATO", "PRIMLJENO", "ZAVRSENO"]);
const BOOKED_TRANSFER_STATUSES = new Set(["POSLATO", "PRIMLJENO", "ZAVRSENO"]);

export type StockLedger = {
  inboundMap: Map<string, number>;
  outboundMap: Map<string, number>;
  calculatedMap: Map<string, number>;
};

type DocLine = { article_id?: string | null; qty?: number | string | null };
type LedgerDoc = {
  id?: string | null;
  type?: string | null;
  status?: string | null;
  source_location_id?: string | null;
  destination_location_id?: string | null;
  document_no?: string | null;
  supplier?: string | null;
  created_at?: string | null;
  cm_document_lines?: DocLine[] | null;
};

function normalizedLines(doc: LedgerDoc) {
  const rows = Array.isArray(doc?.cm_document_lines) ? doc.cm_document_lines : [];
  return rows
    .map((line) => ({
      article_id: String(line?.article_id || ""),
      qty: Number(line?.qty || 0),
    }))
    .filter((line) => line.article_id && Number.isFinite(line.qty) && line.qty > 0)
    .sort((a, b) => a.article_id.localeCompare(b.article_id) || a.qty - b.qty);
}

function linesSignature(doc: LedgerDoc) {
  return normalizedLines(doc)
    .map((line) => `${line.article_id}:${line.qty.toFixed(3)}`)
    .join("|");
}

function addLines(target: Map<string, number>, doc: LedgerDoc) {
  for (const line of normalizedLines(doc)) {
    target.set(line.article_id, Number(target.get(line.article_id) || 0) + line.qty);
  }
}

export async function reconcileCentralStock(admin: any, centralId: string): Promise<StockLedger> {
  const [{ data: docs, error: docsErr }, { data: articles, error: articlesErr }] = await Promise.all([
    admin
      .from("cm_documents")
      .select("id,type,status,source_location_id,destination_location_id,document_no,supplier,created_at,cm_document_lines(article_id,qty)")
      .in("type", ["ULAZ", "TREBOVANJE", "PRENOS"]),
    admin.from("cm_articles").select("id").eq("active", true),
  ]);

  if (docsErr) throw docsErr;
  if (articlesErr) throw articlesErr;

  const allDocs: LedgerDoc[] = (docs || []) as LedgerDoc[];
  const inboundMap = new Map<string, number>();
  const outboundMap = new Map<string, number>();

  // 1) ULAZI: svaki završen stvarni ulaz u CENTRALNI povećava stanje.
  for (const d of allDocs) {
    const type = String(d?.type || "").toUpperCase();
    const status = String(d?.status || "").toUpperCase();
    if (
      type === "ULAZ" &&
      status === "ZAVRSENO" &&
      String(d?.destination_location_id || "") === String(centralId) &&
      String(d?.document_no || "") !== "POCETNO_STANJE" &&
      String(d?.supplier || "") !== "SISTEM_POCETNO_STANJE"
    ) {
      addLines(inboundMap, d);
    }
  }

  // 2) TREBOVANJA: kod ove aplikacije status POSLATO znači da je magacioner
  // potvrdio stvarno izdatu količinu. Zato POSLATO/PRIMLJENO/ZAVRSENO mora biti MINUS.
  // Ovo je važno i za staru istoriju gde PRENOS dokument uopšte nije bio napravljen.
  const bookedRequests = allDocs
    .filter((d) => {
      const type = String(d?.type || "").toUpperCase();
      const status = String(d?.status || "").toUpperCase();
      return type === "TREBOVANJE" && BOOKED_REQUEST_STATUSES.has(status);
    })
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  for (const request of bookedRequests) addLines(outboundMap, request);

  // 3) PRENOSI: direktan prenos (bez trebovanja) takođe mora biti MINUS.
  // Stare verzije su za isto trebovanje ponekad pravile i TREBOVANJE i PRENOS bez veze između ID-jeva.
  // Da se roba ne skine dva puta, uparujemo PRENOS sa prethodnim završеним TREBOVANJEM
  // po odredištu + potpuno istim artiklima/količinama. Samo NEUPARENI PRENOS računamo dodatno.
  const transfers = allDocs
    .filter((d) => {
      const type = String(d?.type || "").toUpperCase();
      const status = String(d?.status || "").toUpperCase();
      return (
        type === "PRENOS" &&
        BOOKED_TRANSFER_STATUSES.has(status) &&
        String(d?.source_location_id || "") === String(centralId)
      );
    })
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  const usedRequestIds = new Set<string>();
  for (const transfer of transfers) {
    const transferDest = String(transfer.destination_location_id || "");
    const transferSig = linesSignature(transfer);
    const transferTime = new Date(transfer.created_at || 0).getTime();

    let pairedRequest: LedgerDoc | undefined;
    for (let i = bookedRequests.length - 1; i >= 0; i -= 1) {
      const request = bookedRequests[i];
      const requestId = String(request.id || "");
      if (!requestId || usedRequestIds.has(requestId)) continue;
      if (String(request.destination_location_id || "") !== transferDest) continue;
      if (linesSignature(request) !== transferSig) continue;
      const requestTime = new Date(request.created_at || 0).getTime();
      if (requestTime > transferTime) continue;
      pairedRequest = request;
      break;
    }

    if (pairedRequest) {
      usedRequestIds.add(String(pairedRequest.id || ""));
      continue; // već je oduzeto kroz TREBOVANJE
    }

    addLines(outboundMap, transfer); // pravi direktan PRENOS
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
