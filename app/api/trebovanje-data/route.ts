import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
import { ensureOneTimeCleanStart } from "@/lib/cleanStart";

export async function GET() {
  try {
    const s = await requireSession();
    await ensureOneTimeCleanStart();

    if (s.role !== "PRODAVNICA" && s.role !== "ADMIN" && s.role !== "MAGACIONER") {
      return NextResponse.json({ ok: false, message: "Nedozvoljen pristup." }, { status: 403 });
    }

    if (!s.location_code) {
      const { data: locations, error } = await admin
        .from("cm_locations")
        .select("id,code,name,type")
        .eq("active", true)
        .eq("type", "STORE")
        .order("name");
      if (error) throw error;
      return NextResponse.json({ ok: true, user: s, needs_location: true, locations: locations || [], stock: [] });
    }

    const { data: location, error: locErr } = await admin
      .from("cm_locations")
      .select("id,code,name,type")
      .eq("code", s.location_code)
      .eq("active", true)
      .single();

    if (locErr || !location) {
      return NextResponse.json(
        { ok: false, message: `Prodavnica ${s.location_code} nije pronađena.` },
        { status: 404 }
      );
    }

    const { data: stock, error: stockErr } = await admin
      .from("cm_stock_view")
      .select("article_id,sifra,naziv,barkod,jm,stanje")
      .order("naziv");

    if (stockErr) throw stockErr;

    return NextResponse.json({ ok: true, user: s, location, stock: stock || [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e.message || "Greška" },
      { status: e.message === "UNAUTHORIZED" ? 401 : 500 }
    );
  }
}
