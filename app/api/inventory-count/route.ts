import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";

export async function POST(req: Request) {
  try {
    const session = await requireSession("ADMIN");
    const body = await req.json();
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    if (!lines.length) {
      return NextResponse.json({ ok: false, message: "Nema stavki za popis." }, { status: 400 });
    }

    const { data: central, error: centralErr } = await admin
      .from("cm_locations")
      .select("id")
      .eq("type", "CENTRAL")
      .limit(1)
      .single();
    if (centralErr) throw centralErr;

    const rows = lines.map((x: any) => ({
      location_id: central.id,
      article_id: String(x.article_id || ""),
      qty: Number(x.qty || 0),
      updated_at: new Date().toISOString(),
    }));

    if (rows.some((x: any) => !x.article_id || !Number.isFinite(x.qty) || x.qty < 0)) {
      return NextResponse.json({ ok: false, message: "Popis sadrži neispravnu količinu." }, { status: 400 });
    }

    const { error } = await admin
      .from("cm_stock")
      .upsert(rows, { onConflict: "location_id,article_id" });
    if (error) throw error;

    return NextResponse.json({ ok: true, updated: rows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Greška" }, { status: 400 });
  }
}
