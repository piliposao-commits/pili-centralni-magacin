import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";

function cleanBarcode(value: unknown) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (["0", "-", "/", "n/a", "na", "nema", "bez barkoda"].includes(s.toLowerCase())) return null;
  return s;
}

export async function PATCH(req: Request) {
  try {
    await requireSession("ADMIN");
    const b = await req.json();
    const articleId = String(b?.article_id || "").trim();
    if (!articleId) return NextResponse.json({ ok: false, message: "Nedostaje artikal." }, { status: 400 });

    const barkod = cleanBarcode(b?.barkod);
    if (!barkod) return NextResponse.json({ ok: false, message: "Unesi barkod." }, { status: 400 });

    const { data: current, error: currentError } = await admin
      .from("cm_articles")
      .select("id,sifra,naziv,barkod")
      .eq("id", articleId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ ok: false, message: "Artikal ne postoji." }, { status: 404 });

    const old = cleanBarcode(current.barkod);
    if (old) {
      if (old === barkod) return NextResponse.json({ ok: true, locked: true });
      return NextResponse.json({ ok: false, message: `Barkod je već sačuvan za ${current.sifra} — ${current.naziv} i više se ne menja.` }, { status: 409 });
    }

    const { data: existing, error: checkError } = await admin
      .from("cm_articles")
      .select("id,sifra,naziv,barkod")
      .eq("barkod", barkod)
      .neq("id", articleId)
      .maybeSingle();
    if (checkError) throw checkError;
    if (existing) {
      return NextResponse.json({ ok: false, message: `Barkod ${barkod} već koristi artikal ${existing.sifra} — ${existing.naziv}.` }, { status: 400 });
    }

    const { error } = await admin
      .from("cm_articles")
      .update({ barkod, updated_at: new Date().toISOString() })
      .eq("id", articleId)
      .is("barkod", null);
    if (error) throw error;
    return NextResponse.json({ ok: true, locked: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message || "Greška.") }, { status: 400 });
  }
}
