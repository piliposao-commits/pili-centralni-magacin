import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    if (!["PRODAVNICA", "ADMIN", "MAGACIONER"].includes(s.role)) {
      return NextResponse.json({ ok:false, message:"Nedozvoljen pristup." }, { status:403 });
    }

    const b = await req.json();
    const articleId = String(b?.article_id || "").trim();
    const packaging = Math.floor(Number(b?.transportno_pakovanje || 0));

    if (!articleId) return NextResponse.json({ ok:false, message:"Nedostaje artikal." }, { status:400 });
    if (!Number.isFinite(packaging) || packaging <= 0 || packaging > 10000) {
      return NextResponse.json({ ok:false, message:"Unesi ispravan broj komada u jednoj kutiji." }, { status:400 });
    }

    const { data: current, error: currentError } = await admin
      .from("cm_articles")
      .select("id,transportno_pakovanje")
      .eq("id", articleId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ ok:false, message:"Artikal ne postoji." }, { status:404 });

    // Ako je pakovanje već podešeno, prodavnica ga ne može menjati. Izmena ide kroz admin.
    const old = Number(current.transportno_pakovanje || 0);
    if (old > 0 && old !== packaging && s.role === "PRODAVNICA") {
      return NextResponse.json({ ok:false, message:`Pakovanje je već podešeno na ${old} kom/kutija. Izmenu radi ADMIN.` }, { status:409 });
    }

    const { error } = await admin
      .from("cm_articles")
      .update({ transportno_pakovanje: packaging, updated_at: new Date().toISOString() })
      .eq("id", articleId);
    if (error) throw error;

    return NextResponse.json({ ok:true, transportno_pakovanje:packaging });
  } catch (e:any) {
    return NextResponse.json({ ok:false, message:String(e?.message || "Greška.") }, { status:e?.message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
