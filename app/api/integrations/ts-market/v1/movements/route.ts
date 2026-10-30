import { NextResponse } from "next/server";
import { admin } from "@/lib/server";

function authorized(req: Request) {
  const token = process.env.TS_MARKET_INTEGRATION_TOKEN || "";
  const auth = req.headers.get("authorization") || "";
  return Boolean(token) && auth === `Bearer ${token}`;
}

function decodeCursor(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function encodeCursor(created_at: string, movement_id: string) {
  return Buffer.from(JSON.stringify({ created_at, movement_id })).toString("base64url");
}

export async function GET(req: Request) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 100)));
    const cursor = decodeCursor(url.searchParams.get("cursor"));

    let q = admin
      .from("ts_market_movements")
      .select("movement_id,revision,occurred_at,pili_store_code,ts_market_warehouse_code,kind,pili_article_id,pili_sifra,item_name,unit,quantity,from_warehouse_code,to_warehouse_code,source_record_id,test,status,created_at")
      .eq("status", "READY")
      .order("created_at", { ascending: true })
      .order("movement_id", { ascending: true })
      .limit(limit + 1);

    if (from) q = q.gte("occurred_at", from);
    if (to) q = q.lte("occurred_at", to);
    if (cursor?.created_at) {
      const safeId = String(cursor.movement_id || "").replace(/[,()]/g, "");
      q = q.or(`created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},movement_id.gt.${safeId})`);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    const page = rows.slice(0, limit);
    const items = page.map((m: any) => ({
      movement_id: m.movement_id,
      revision: Number(m.revision || 1),
      occurred_at: m.occurred_at,
      store: {
        pili_store_code: m.pili_store_code,
        ts_market_warehouse_code: m.ts_market_warehouse_code || "TO_MAP",
      },
      kind: m.kind,
      from_warehouse_code: m.from_warehouse_code || "20",
      to_warehouse_code: m.to_warehouse_code || m.ts_market_warehouse_code || "TO_MAP",
      item: {
        pili_article_id: m.pili_article_id,
        pili_sifra: m.pili_sifra,
        name: m.item_name,
        unit: m.unit,
      },
      quantity: Number(m.quantity || 0).toFixed(3),
      from_stock_class: null,
      to_stock_class: null,
      source_record_id: m.source_record_id,
      test: Boolean(m.test),
      status: "READY",
    }));

    let next_cursor: string | null = null;
    if (rows.length > limit && page.length) {
      const last: any = page[page.length - 1];
      next_cursor = encodeCursor(last.created_at, last.movement_id);
    }

    return NextResponse.json({ items, next_cursor });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "TS Market movements error" }, { status: 500 });
  }
}
