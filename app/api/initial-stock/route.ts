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

    // VAŽNO: ovde se čuva SAMO istorijsko početno stanje.
    // Trenutno stanje (cm_stock) se ne dira.
    await saveInitialStockValue(central.id, articleId, qty, session.id);

    const { data: currentRow, error: currentErr } = await admin
      .from("cm_stock")
      .select("qty")
      .eq("location_id", central.id)
      .eq("article_id", articleId)
      .maybeSingle();
    if (currentErr) throw currentErr;

    return NextResponse.json({ ok: true, initial_qty: qty, current_qty: Number(currentRow?.qty || 0) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Greška" }, { status: 400 });
  }
}
