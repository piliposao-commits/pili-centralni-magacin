import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireSession } from "@/lib/server";

export const runtime = "nodejs";

type ScanItem = {
  rb?: string | number;
  sifra?: string;
  naziv?: string;
  barkod?: string;
  jm?: string;
  kolicina?: number;
  maloprodajna_cena?: number;
};

type PageResult = {
  document_no?: string;
  supplier?: string;
  items?: ScanItem[];
};

function cleanJson(raw: string) {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function itemKey(item: ScanItem) {
  const rb = norm(item.rb);
  if (rb) return `rb:${rb}`;
  return [
    norm(item.sifra),
    norm(item.barkod),
    norm(item.naziv),
    norm(item.jm),
    String(Number(item.kolicina || 0)),
    String(Number(item.maloprodajna_cena || 0)),
  ].join("|");
}

export async function POST(req: Request) {
  try {
    await requireSession("ADMIN");

    const form = await req.formData();
    const multiFiles = form
      .getAll("files")
      .filter((x): x is File => x instanceof File && x.size > 0);
    const legacyFile = form.get("file");
    const files =
      multiFiles.length > 0
        ? multiFiles
        : legacyFile instanceof File && legacyFile.size > 0
          ? [legacyFile]
          : [];

    if (!files.length) throw new Error("Nema slike kalkulacije.");
    if (files.length > 8) throw new Error("Najviše 8 strana može biti u jednoj kalkulaciji.");

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        throw new Error("Sve strane moraju biti fotografije.");
      }
      if (file.size > 12 * 1024 * 1024) {
        throw new Error(`Slika ${file.name || ""} je prevelika. Maksimum je 12 MB po slici.`);
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const pageResults: PageResult[] = [];

    // Svaku stranu čitamo zasebno. Ovo je pouzdanije od slanja svih fotografija
    // u jednom zahtevu, jer model ne može da "preskoči" drugu/treću stranu.
    for (let pageIndex = 0; pageIndex < files.length; pageIndex++) {
      const file = files[pageIndex];
      const bytes = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${file.type || "image/jpeg"};base64,${bytes.toString("base64")}`;

      const response = await client.responses.create({
        model: "gpt-5.6-luna",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Ovo je STRANA ${pageIndex + 1} od ${files.length} iste PILI kalkulacije.

Pročitaj SAMO ovu stranu i vrati isključivo validan JSON bez markdown-a:
{"document_no":"", "supplier":"", "items":[{"rb":"","sifra":"","naziv":"","barkod":"","jm":"KOM","kolicina":0,"maloprodajna_cena":0}]}.

Pravila:
- Izvuci SVAKI vidljiv red artikla sa ove strane. Nemoj preskakati redove.
- rb je redni broj iz prve kolone (R.Br.) ako je vidljiv.
- sifra je kolona Šifra.
- naziv je naziv artikla.
- barkod je broj ispod naziva.
- jm je kolona JM.
- kolicina je kolona Količina.
- maloprodajna_cena je poslednja kolona Malopr. cena.
- Decimalni zarez pretvori u tačku.
- document_no i supplier uzmi iz zaglavlja samo ako su vidljivi na ovoj strani; inače prazno.
- Ne izmišljaj. Ako nešto nije čitljivo stavi prazan string ili 0.
- Obrati posebnu pažnju da broj items elemenata odgovara svim vidljivim redovima na strani.`,
              },
              { type: "input_image", image_url: dataUrl, detail: "high" },
            ],
          },
        ],
      });

      const parsed = JSON.parse(cleanJson(response.output_text)) as PageResult;
      if (!Array.isArray(parsed.items)) {
        throw new Error(`AI nije vratio ispravnu listu stavki za stranu ${pageIndex + 1}.`);
      }
      pageResults.push(parsed);
    }

    let document_no = "";
    let supplier = "";
    const items: ScanItem[] = [];
    const seen = new Set<string>();

    for (const page of pageResults) {
      if (!document_no && page.document_no) document_no = String(page.document_no).trim();
      if (!supplier && page.supplier) supplier = String(page.supplier).trim();

      for (const rawItem of page.items || []) {
        const item: ScanItem = {
          rb: rawItem.rb ?? "",
          sifra: String(rawItem.sifra ?? "").trim(),
          naziv: String(rawItem.naziv ?? "").trim(),
          barkod: String(rawItem.barkod ?? "").trim(),
          jm: String(rawItem.jm ?? "KOM").trim() || "KOM",
          kolicina: Number(rawItem.kolicina || 0),
          maloprodajna_cena: Number(rawItem.maloprodajna_cena || 0),
        };

        const key = itemKey(item);
        // Duplikat iste fizičke stavke na preklopljenim fotografijama preskačemo.
        if (seen.has(key)) continue;
        seen.add(key);

        // rb nam služi samo za spajanje/deduplikaciju; UI i knjiženje ga ne trebaju.
        const { rb: _rb, ...publicItem } = item;
        items.push(publicItem);
      }
    }

    if (!items.length) throw new Error("AI nije pronašao nijednu stavku na priloženim stranama.");

    return NextResponse.json({
      ok: true,
      document_no,
      supplier,
      items,
      pages: files.length,
      page_item_counts: pageResults.map((x) => x.items?.length || 0),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e.message || "Greška pri čitanju kalkulacije." },
      { status: 400 }
    );
  }
}
