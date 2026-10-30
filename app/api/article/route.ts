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

    const hasPackaging = Object.prototype.hasOwnProperty.call(b || {}, "transportno_pakovanje");
    const packagingRaw = Number(b?.transportno_pakovanje || 0);
    const packaging = hasPackaging ? (packagingRaw > 0 ? Math.floor(packagingRaw) : null) : undefined;
    const hasBarcode = Object.prototype.hasOwnProperty.call(b || {}, "barkod");
    const barkod = hasBarcode ? cleanBarcode(b?.barkod) : undefined;

    const { data: current, error: currentError } = await admin
      .from("cm_articles")
      .select("id,sifra,naziv,barkod,transportno_pakovanje")
      .eq("id", articleId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ ok: false, message: "Artikal ne postoji." }, { status: 404 });

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };

    if (hasPackaging) patch.transportno_pakovanje = packaging;

    if (hasBarcode) {
      if (!barkod) {
        // Barkod se ne briše ako je već zaključan; prazna vrednost znači "bez izmene".
        if (!current.barkod && !hasPackaging) {
          return NextResponse.json({ ok: false, message: "Unesi barkod." }, { status: 400 });
        }
      } else {
        const old = cleanBarcode(current.barkod);
        if (old && old !== barkod) {
          return NextResponse.json({ ok: false, message: `Barkod je već sačuvan za ${current.sifra} — ${current.naziv} i više se ne menja.` }, { status: 409 });
        }
        if (!old) {
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
          patch.barkod = barkod;
        }
      }
    }

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ ok: false, message: "Nema podataka za čuvanje." }, { status: 400 });
    }

    const { error } = await admin.from("cm_articles").update(patch).eq("id", articleId);
    if (error) throw error;
    return NextResponse.json({ ok: true, transportno_pakovanje: packaging ?? current.transportno_pakovanje ?? null, locked: !!current.barkod || !!patch.barkod });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message || "Greška.") }, { status: 400 });
  }
}
