import { NextResponse } from "next/server";
import { admin } from "@/lib/server";
import { reconcileCentralStock } from "@/lib/centralStock";

function authorized(req: Request) {
  const token = process.env.TS_MARKET_INTEGRATION_TOKEN || "";
  const auth = req.headers.get("authorization") || "";
  return Boolean(token) && auth === `Bearer ${token}`;
}

export async function POST(req: Request) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const movementId = String(body?.movement_id || "");
    const revision = Number(body?.revision || 1);
    const status = String(body?.status || "").toUpperCase();
    const tsMarketDocumentId = body?.ts_market_document_id ? String(body.ts_market_document_id) : null;
    const postedAt = body?.posted_at ? String(body.posted_at) : new Date().toISOString();

    if (!movementId || !Number.isFinite(revision) || !["POSTED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid acknowledgement" }, { status: 400 });
    }

    const { data: movement, error: findErr } = await admin
      .from("ts_market_movements")
      .select("movement_id,revision,status,source_record_id")
      .eq("movement_id", movementId)
      .eq("revision", revision)
      .single();
    if (findErr) throw findErr;

    // Idempotency: već POSTED movement se ne knjiži ponovo.
    if (String(movement.status || "").toUpperCase() === "POSTED" && status === "POSTED") {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    const { error: updateErr } = await admin
      .from("ts_market_movements")
      .update({
        status,
        ts_market_document_id: tsMarketDocumentId,
        posted_at: status === "POSTED" ? postedAt : null,
        last_error: status === "REJECTED" ? String(body?.message || body?.error || "TS Market rejected movement") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("movement_id", movementId)
      .eq("revision", revision);
    if (updateErr) throw updateErr;

    const sourceId = String(movement.source_record_id || "");
    if (sourceId) {
      if (status === "REJECTED") {
        // Vrati zahtev adminu za ponovni pokušaj. POSTED stavke ostaju POSTED,
        // pa se pri retry-u ponovo šalju samo neuspele stavke.
        await admin.from("cm_documents")
          .update({ status: "POSLATO", updated_at: new Date().toISOString() })
          .eq("id", sourceId)
          .eq("type", "TREBOVANJE");
      } else {
        const { data: allRows, error: allErr } = await admin
          .from("ts_market_movements")
          .select("status")
          .eq("source_record_id", sourceId);
        if (allErr) throw allErr;

        const allPosted = (allRows || []).length > 0 && (allRows || []).every((x: any) => String(x.status || "").toUpperCase() === "POSTED");
        if (allPosted) {
          const { error: docErr } = await admin.from("cm_documents")
            .update({ status: "PRIMLJENO", updated_at: new Date().toISOString() })
            .eq("id", sourceId)
            .eq("type", "TREBOVANJE");
          if (docErr) throw docErr;

          const { data: central, error: centralErr } = await admin.from("cm_locations")
            .select("id").eq("type", "CENTRAL").limit(1).single();
          if (centralErr || !central?.id) throw centralErr || new Error("Centralni magacin nije pronađen.");
          await reconcileCentralStock(admin, String(central.id));
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "TS Market acknowledgement error" }, { status: 500 });
  }
}
