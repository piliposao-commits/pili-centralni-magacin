import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";

const BUCKET = "cm-article-images";

async function ensureBucket() {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw error;
  if (!(buckets || []).some((b: any) => b.name === BUCKET)) {
    const { error: createError } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
    });
    if (createError && !String(createError.message || "").toLowerCase().includes("already")) throw createError;
  }
}

export async function POST(req: Request) {
  try {
    await requireSession("ADMIN");
    const fd = await req.formData();
    const articleId = String(fd.get("article_id") || "").trim();
    const file = fd.get("file");

    if (!articleId) return NextResponse.json({ ok: false, message: "Nedostaje artikal." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "Izaberi sliku." }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ ok: false, message: "Fajl mora biti slika." }, { status: 400 });
    if (file.size > 15 * 1024 * 1024) return NextResponse.json({ ok: false, message: "Slika je veća od 15 MB." }, { status: 400 });

    const { data: article, error: articleError } = await admin
      .from("cm_articles")
      .select("id,sifra,naziv")
      .eq("id", articleId)
      .maybeSingle();
    if (articleError) throw articleError;
    if (!article) return NextResponse.json({ ok: false, message: "Artikal ne postoji." }, { status: 404 });

    await ensureBucket();
    const { data: existing, error: listError } = await admin.storage.from(BUCKET).list("", { limit: 1000, search: articleId });
    if (listError) throw listError;
    if ((existing || []).some((x: any) => x.name === articleId)) {
      return NextResponse.json({ ok: false, message: "Slika je već sačuvana za ovaj artikal." }, { status: 409 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(articleId, bytes, {
      contentType: file.type || "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(articleId);
    return NextResponse.json({ ok: true, image_url: pub.publicUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message || "Greška pri čuvanju slike.") }, { status: 400 });
  }
}
