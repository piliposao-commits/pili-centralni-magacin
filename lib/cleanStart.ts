import { admin } from "@/lib/server";

const CLEAN_START_MARKER = "CLEAN-START-DELETE-ALL-ARTICLES-2026-09-24-V2";

export async function ensureOneTimeCleanStart() {
  const { data: marker, error: markerErr } = await admin
    .from("cm_documents")
    .select("id")
    .eq("document_no", CLEAN_START_MARKER)
    .maybeSingle();

  if (markerErr) throw markerErr;
  if (marker) return;

  // Potpuno praznimo robu i istoriju robe. Korisnici i lokacije ostaju.
  const { error: docsErr } = await admin
    .from("cm_documents")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (docsErr) throw docsErr;

  const { error: stockErr } = await admin
    .from("cm_stock")
    .delete()
    .neq("article_id", "00000000-0000-0000-0000-000000000000");
  if (stockErr) throw stockErr;

  const { error: articlesErr } = await admin
    .from("cm_articles")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (articlesErr) throw articlesErr;

  const { data: central, error: centralErr } = await admin
    .from("cm_locations")
    .select("id")
    .eq("type", "CENTRAL")
    .limit(1)
    .maybeSingle();
  if (centralErr) throw centralErr;

  const { error: markerInsertErr } = await admin.from("cm_documents").insert({
    type: "ULAZ",
    status: "ZAVRSENO",
    destination_location_id: central?.id || null,
    document_no: CLEAN_START_MARKER,
    supplier: "SISTEM - PRAZAN MAGACIN",
  });
  if (markerInsertErr) throw markerInsertErr;
}
