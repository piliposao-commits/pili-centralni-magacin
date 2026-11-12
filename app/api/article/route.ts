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

export async function DELETE(req: Request) {
  try {
    await requireSession("ADMIN");
    const b = await req.json().catch(() => ({}));
    const articleId = String(b?.article_id || "").trim();
    if (!articleId) return NextResponse.json({ ok: false, message: "Nedostaje artikal." }, { status: 400 });

    const { data: article, error: articleError } = await admin
      .from("cm_articles")
      .select("id,sifra,naziv")
      .eq("id", articleId)
      .maybeSingle();
    if (articleError) throw articleError;
    if (!article) return NextResponse.json({ ok: false, message: "Artikal ne postoji." }, { status: 404 });

    const { count: documentCount, error: documentError } = await admin
      .from("cm_document_lines")
      .select("id", { count: "exact", head: true })
      .eq("article_id", articleId);
    if (documentError) throw documentError;
    if (Number(documentCount || 0) > 0) {
      return NextResponse.json({
        ok: false,
        message: `Artikal ${article.sifra} — ${article.naziv} ima istoriju dokumenata. Prvo obriši pogrešnu kalkulaciju/vezu iz koje je nastao; neću obrisati istoriju drugih ulaza ili izlaza.`,
      }, { status: 409 });
    }

    const inventoryCheck = await admin
      .from("cm_inventory_history")
      .select("id", { count: "exact", head: true })
      .eq("article_id", articleId);
    if (!inventoryCheck.error && Number(inventoryCheck.count || 0) > 0) {
      return NextResponse.json({ ok: false, message: "Artikal ima istoriju popisa i ne može bezbedno da se obriše." }, { status: 409 });
    }
    if (inventoryCheck.error && inventoryCheck.error.code !== "42P01") throw inventoryCheck.error;

    const tsCheck = await admin
      .from("ts_market_movements")
      .select("movement_id", { count: "exact", head: true })
      .eq("pili_article_id", articleId);
    if (!tsCheck.error && Number(tsCheck.count || 0) > 0) {
      return NextResponse.json({ ok: false, message: "Artikal već ima TS Market kretanje i ne može bezbedno da se obriše." }, { status: 409 });
    }
    if (tsCheck.error && tsCheck.error.code !== "42P01") throw tsCheck.error;

    const { data: stocks, error: stockError } = await admin.from("cm_stock").select("location_id,qty").eq("article_id", articleId);
    if (stockError) throw stockError;
    const nonZero = (stocks || []).find((x: any) => Math.abs(Number(x.qty || 0)) > 0.000001);
    if (nonZero) {
      return NextResponse.json({ ok: false, message: `Artikal još ima stanje ${Number(nonZero.qty || 0)}. Prvo obriši pogrešnu kalkulaciju ili uradi ispravku stanja.` }, { status: 409 });
    }

    await admin.from("cm_stock").delete().eq("article_id", articleId);
    try { await admin.storage.from("cm-article-images").remove([articleId]); } catch {}
    const { error: deleteError } = await admin.from("cm_articles").delete().eq("id", articleId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true, message: `Artikal ${article.sifra} — ${article.naziv} je obrisan.` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message || "Greška pri brisanju artikla.") }, { status: 400 });
  }
}
