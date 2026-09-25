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
    if (s.role !== "ADMIN" && s.role !== "MAGACIONER") {
      return NextResponse.json({ ok: false, message: "Nedozvoljen pristup." }, { status: 403 });
    }
    await ensureOneTimeCleanStart();

    const { data: central, error: centralErr } = await admin
      .from("cm_locations")
      .select("id")
      .eq("type", "CENTRAL")
      .limit(1)
      .single();
    if (centralErr || !central?.id) throw centralErr || new Error("Centralni magacin nije pronađen.");

    const [{ data: locations }, { data: stock }, { data: reqs }, { data: docs }, images] = await Promise.all([
      admin.from("cm_locations").select("id,code,name,type").eq("active", true).order("name"),
      admin.from("cm_stock_view").select("*").order("naziv"),
      admin.from("cm_requests_view").select("*").order("created_at", { ascending: false }).limit(100),
      admin
        .from("cm_documents")
        .select("id,type,status,source_location_id,destination_location_id,document_no,supplier,cm_document_lines(article_id,qty)")
        .in("type", ["ULAZ", "PRENOS"]),
      articleImageMap(),
    ]);

    // Pravilo magacina:
    // POČETNO = 0
    // TRENUTNO = svi pravi ULAZI - svi potvrđeni PRENOSI/TREBOVANJA
    // Samo kreiranje trebovanja NE skida robu; izlaz postoji tek kada magacioner potvrdi
    // i tada nastane PRENOS dokument.
    const inboundMap = new Map<string, number>();
    const outboundMap = new Map<string, number>();

    for (const d of docs || []) {
      const type = String((d as any).type || "").toUpperCase();
      const status = String((d as any).status || "").toUpperCase();
      const lines = Array.isArray((d as any).cm_document_lines) ? (d as any).cm_document_lines : [];

      if (
        type === "ULAZ" &&
        status === "ZAVRSENO" &&
        String((d as any).destination_location_id || "") === String(central.id) &&
        String((d as any).document_no || "") !== "POCETNO_STANJE" &&
        String((d as any).supplier || "") !== "SISTEM_POCETNO_STANJE"
      ) {
        for (const line of lines) {
          const id = String(line.article_id || "");
          if (!id) continue;
          inboundMap.set(id, Number(inboundMap.get(id) || 0) + Number(line.qty || 0));
        }
      }

      if (
        type === "PRENOS" &&
        ["POSLATO", "PRIMLJENO", "ZAVRSENO"].includes(status) &&
        String((d as any).source_location_id || "") === String(central.id)
      ) {
        for (const line of lines) {
          const id = String(line.article_id || "");
          if (!id) continue;
          outboundMap.set(id, Number(outboundMap.get(id) || 0) + Number(line.qty || 0));
        }
      }
    }

    const safeStock = (stock || []).map((x: any) => {
      const articleId = String(x.article_id);
      const inbound = Number(inboundMap.get(articleId) || 0);
      const outbound = Number(outboundMap.get(articleId) || 0);
      const calculated = inbound - outbound;
      const row = {
        ...x,
        image_url: images.get(articleId) || null,
        initial_qty: 0,
        inbound_qty: inbound,
        outbound_qty: outbound,
        calculated_qty: calculated,
      };
      return s.role === "ADMIN" ? row : { ...row, maloprodajna_cena: undefined, vrednost: undefined };
    });

    return NextResponse.json({ ok: true, user: s, locations, stock: safeStock, requests: reqs || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
