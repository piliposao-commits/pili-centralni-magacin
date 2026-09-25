import { NextResponse } from "next/server";
import { admin } from "@/lib/server";
import { ensureOneTimeCleanStart } from "@/lib/cleanStart";
import { reconcileCentralStock } from "@/lib/centralStock";

export async function GET() {
  try {
    await ensureOneTimeCleanStart();

    const { data: central, error: centralErr } = await admin
      .from("cm_locations")
      .select("id")
      .eq("type", "CENTRAL")
      .limit(1)
      .single();
    if (centralErr || !central?.id) throw centralErr || new Error("Centralni magacin nije pronađen.");
    await reconcileCentralStock(admin, String(central.id));

    const [{ data: stock, error: stockErr }, { data: locations, error: locErr }] = await Promise.all([
      admin.from("cm_stock_view").select("article_id,sifra,naziv,barkod,jm,stanje").order("naziv"),
      admin.from("cm_locations").select("id,name,type").eq("active", true).order("name"),
    ]);

    if (stockErr) throw stockErr;
    if (locErr) throw locErr;

    return NextResponse.json({ ok: true, stock: stock || [], locations: locations || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message || "Greška" }, { status: 500 });
  }
}
