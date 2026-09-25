import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
import { ensureInitialStockSnapshot } from "@/lib/initialStock";

function cleanBarcode(value: unknown) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (["0", "-", "/", "n/a", "na", "nema", "bez barkoda"].includes(s.toLowerCase())) return null;
  return s;
}

export async function POST(req: Request) {
  try {
    const session = await requireSession("ADMIN");
    const b = await req.json();
    const rawLines = Array.isArray(b?.lines) ? b.lines : [];
    if (!rawLines.length) return NextResponse.json({ ok: false, message: "Nema stavki za knjiženje." }, { status: 400 });

    const lines = rawLines.map((x: any) => ({
      sifra: String(x?.sifra ?? "").trim(),
      naziv: String(x?.naziv ?? "").trim(),
      jm: String(x?.jm ?? "KOM").trim() || "KOM",
      barkod: cleanBarcode(x?.barkod),
      kolicina: Number(x?.kolicina ?? 0),
      maloprodajna_cena: Number(x?.maloprodajna_cena ?? 0),
    }));

    const invalid = lines.find((x: any) => !x.sifra || !Number.isFinite(x.kolicina) || x.kolicina <= 0);
    if (invalid) return NextResponse.json({ ok: false, message: `Proveri stavku "${invalid?.naziv || invalid?.sifra || "bez naziva"}" — šifra i količina moraju biti ispravne.` }, { status: 400 });

    const { data: central, error: centralError } = await admin.from("cm_locations").select("id").eq("type", "CENTRAL").limit(1).maybeSingle();
    if (centralError) throw centralError;
    if (!central) throw new Error("Centralni magacin nije pronađen.");

    const { data: doc, error: docError } = await admin.from("cm_documents").insert({
      type: "ULAZ",
      status: "ZAVRSENO",
      destination_location_id: central.id,
      document_no: b?.document_no || null,
      supplier: b?.supplier || null,
      created_by: session.id,
    }).select("id").single();
    if (docError) throw docError;

    let processed = 0;
    for (const x of lines) {
      const { data: found, error: findError } = await admin.from("cm_articles").select("id,sifra,naziv,barkod,jm,maloprodajna_cena").eq("sifra", x.sifra).maybeSingle();
      if (findError) throw findError;

      let safeBarcode = x.barkod;
      if (safeBarcode) {
        const { data: owner, error: ownerError } = await admin.from("cm_articles").select("id,sifra").eq("barkod", safeBarcode).maybeSingle();
        if (ownerError) throw ownerError;
        if (owner && (!found || owner.id !== found.id)) safeBarcode = null;
      }

      let article: any;
      if (found) {
        const patch: any = { naziv: x.naziv || found.naziv, jm: x.jm || found.jm, updated_at: new Date().toISOString() };
        if (!found.barkod && safeBarcode) patch.barkod = safeBarcode;
        if (x.maloprodajna_cena > 0) patch.maloprodajna_cena = x.maloprodajna_cena;
        const { data: updated, error: updateError } = await admin.from("cm_articles").update(patch).eq("id", found.id).select("id,sifra,naziv,barkod,jm,maloprodajna_cena").single();
        if (updateError) throw updateError;
        article = updated;
      } else {
        const { data: created, error: createError } = await admin.from("cm_articles").insert({
          sifra: x.sifra,
          naziv: x.naziv || x.sifra,
          barkod: safeBarcode,
          jm: x.jm,
          maloprodajna_cena: x.maloprodajna_cena > 0 ? x.maloprodajna_cena : 0,
          active: true,
        }).select("id,sifra,naziv,barkod,jm,maloprodajna_cena").single();
        if (createError) throw createError;
        article = created;
      }

      const { data: cur, error: curError } = await admin.from("cm_stock").select("qty").eq("location_id", central.id).eq("article_id", article.id).maybeSingle();
      if (curError) throw curError;
      await ensureInitialStockSnapshot(central.id, [{ article_id: article.id, qty: Number(cur?.qty || 0) }], session.id);
      const nextQty = Number(cur?.qty || 0) + x.kolicina;
      const { error: stockError } = await admin.from("cm_stock").upsert({ location_id: central.id, article_id: article.id, qty: nextQty, updated_at: new Date().toISOString() }, { onConflict: "location_id,article_id" });
      if (stockError) throw stockError;

      const { error: lineError } = await admin.from("cm_document_lines").insert({
        document_id: doc.id,
        article_id: article.id,
        sifra: article.sifra,
        naziv: article.naziv,
        barkod: article.barkod,
        jm: article.jm,
        qty: x.kolicina,
        price: Number(article.maloprodajna_cena || 0),
      });
      if (lineError) throw lineError;
      processed += 1;
    }

    return NextResponse.json({ ok: true, document_id: doc.id, processed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message || "Greška pri knjiženju ulaza robe.") }, { status: 400 });
  }
}
