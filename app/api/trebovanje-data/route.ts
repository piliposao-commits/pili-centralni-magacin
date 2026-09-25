import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
import { ensureOneTimeCleanStart } from "@/lib/cleanStart";

const BUCKET = "cm-article-images";

async function articleImageMap() {
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    if (!(buckets || []).some((b: any) => b.name === BUCKET)) return new Map<string, string>();
    const { data: files, error } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
    if (error) return new Map<string, string>();
    const m = new Map<string, string>();
    for (const f of files || []) {
      if (!f?.name) continue;
      const { data } = admin.storage.from(BUCKET).getPublicUrl(f.name);
      m.set(f.name, data.publicUrl);
    }
    return m;
  } catch {
    return new Map<string, string>();
  }
}

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

    const [{ data: stock, error: stockErr }, images] = await Promise.all([
      admin
        .from("cm_stock_view")
        .select("article_id,sifra,naziv,barkod,jm,stanje")
        .order("naziv"),
      articleImageMap(),
    ]);

    if (stockErr) throw stockErr;

    const safeStock = (stock || []).map((x: any) => ({
      ...x,
      image_url: images.get(String(x.article_id)) || null,
    }));

    return NextResponse.json({ ok: true, user: s, location, stock: safeStock });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e.message || "Greška" },
      { status: e.message === "UNAUTHORIZED" ? 401 : 500 }
    );
  }
}
