import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
import { ensureOneTimeCleanStart } from "@/lib/cleanStart";
import { reconcileCentralStock } from "@/lib/centralStock";

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

    // Pre svakog prikaza poravnaj fizičko stanje sa knjigom kretanja.
    // Ovo automatski uključuje i STARA završena trebovanja.
    const { inboundMap, outboundMap } = await reconcileCentralStock(admin, String(central.id));

    const [{ data: locations }, { data: stock }, { data: reqs }, { data: inbounds }, { data: articlePositions }, images] = await Promise.all([
      admin.from("cm_locations").select("id,code,name,type").eq("active", true).order("name"),
      admin.from("cm_stock_view").select("*").order("naziv"),
      admin.from("cm_requests_view").select("*").order("created_at", { ascending: false }).limit(100),
      admin
        .from("cm_documents")
        .select("id,document_no,supplier,status,created_at,cm_document_lines(id,article_id,sifra,naziv,barkod,jm,qty,price)")
        .eq("type", "ULAZ")
        .eq("destination_location_id", central.id)
        .order("created_at", { ascending: false })
        .limit(100),
      admin.from("cm_articles").select("id,image_zoom,image_x,image_y"),
      articleImageMap(),
    ]);

    const positionMap = new Map(
      (articlePositions || []).map((a: any) => [
        String(a.id),
        {
          image_zoom: Number(a.image_zoom || 1),
          image_x: Number(a.image_x || 0),
          image_y: Number(a.image_y || 0),
        },
      ])
    );

    const safeStock = (stock || []).map((x: any) => {
      const articleId = String(x.article_id);
      const position = positionMap.get(articleId) || { image_zoom: 1, image_x: 0, image_y: 0 };
      const inbound = Number(inboundMap.get(articleId) || 0);
      const outbound = Number(outboundMap.get(articleId) || 0);
      const calculated = inbound - outbound;
      const row = {
        ...x,
        image_url: images.get(articleId) || null,
        image_zoom: position.image_zoom,
        image_x: position.image_x,
        image_y: position.image_y,
        initial_qty: 0,
        inbound_qty: inbound,
        outbound_qty: outbound,
        calculated_qty: calculated,
      };
      return s.role === "ADMIN" ? row : { ...row, maloprodajna_cena: undefined, vrednost: undefined };
    });

    // U admin sekciji "Prethodni ulazi" prikazujemo samo stvarne ulaze sa kalkulacija.
    // Sakrivamo sistemsko početno stanje, clean-start i eventualne REPAIR/REPAR servisne dokumente.
    const safeInbounds = (inbounds || [])
      .filter((d: any) => {
        const marker = `${d?.document_no || ""} ${d?.supplier || ""}`.toUpperCase();
        return !["POCETNO", "SISTEM", "CLEAN-START", "REPAIR", "REPAR"].some((x) => marker.includes(x));
      })
      .map((d: any) => ({
        id: d.id,
        document_no: d.document_no || null,
        supplier: d.supplier || null,
        status: d.status,
        created_at: d.created_at,
        lines: Array.isArray(d.cm_document_lines) ? d.cm_document_lines : [],
      }));

    return NextResponse.json({ ok: true, user: s, locations, stock: safeStock, requests: reqs || [], inbounds: safeInbounds });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: e.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
