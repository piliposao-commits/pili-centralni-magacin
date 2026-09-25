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
    if (s.role !== "ADMIN" && s.role !== "MAGACIONER") return NextResponse.json({ ok: false, message: "Nedozvoljen pristup." }, { status: 403 });
    await ensureOneTimeCleanStart();

    const [{ data: locations }, { data: stock }, { data: reqs }, images] = await Promise.all([
      admin.from("cm_locations").select("id,code,name,type").eq("active", true).order("name"),
      admin.from("cm_stock_view").select("*").order("naziv"),
      admin.from("cm_requests_view").select("*").order("created_at", { ascending: false }).limit(100),
      articleImageMap(),
    ]);

    const safeStock = (stock || []).map((x: any) => {
      const row = { ...x, image_url: images.get(String(x.article_id)) || null };
      return s.role === "ADMIN" ? row : { ...row, maloprodajna_cena: undefined, vrednost: undefined };
    });

    return NextResponse.json({ ok: true, user: s, locations, stock: safeStock, requests: reqs || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
