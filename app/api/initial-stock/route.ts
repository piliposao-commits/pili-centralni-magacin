import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
import { saveInitialStockValue } from "@/lib/initialStock";

export async function POST(req: Request) {
  try {
    const session = await requireSession("ADMIN");
    const body = await req.json();
    const articleId = String(body?.article_id || "");
    const qty = Number(body?.qty || 0);

    if (!articleId || !Number.isFinite(qty) || qty < 0) {
      return NextResponse.json({ ok: false, message: "Neispravna količina." }, { status: 400 });
    }

    const { data: central, error: centralErr } = await admin
      .from("cm_locations")
      .select("id")
      .eq("type", "CENTRAL")
      .limit(1)
      .single();
    if (centralErr || !central?.id) throw centralErr || new Error("Centralni magacin nije pronađen.");

    const { error: stockErr } = await admin
      .from("cm_stock")
      .upsert(
        { location_id: central.id, article_id: articleId, qty, updated_at: new Date().toISOString() },
        { onConflict: "location_id,article_id" }
      );
    if (stockErr) throw stockErr;

    await saveInitialStockValue(central.id, articleId, qty, session.id);

    return NextResponse.json({ ok: true, initial_qty: qty, current_qty: qty });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Greška" }, { status: 400 });
  }
}
