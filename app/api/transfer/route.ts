import { NextResponse } from "next/server";
import { admin, requireSession } from "@/lib/server";
import { reconcileCentralStock } from "@/lib/centralStock";

type Line = { article_id: string; qty: number };

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    if (s.role !== "ADMIN" && s.role !== "MAGACIONER") {
      return NextResponse.json({ ok: false, message: "Nedozvoljen pristup." }, { status: 403 });
    }

    const body = await req.json();
    const destinationId = String(body?.destination_id || "");
    const requestId = body?.request_id ? String(body.request_id) : null;
    const lines: Line[] = Array.isArray(body?.lines)
      ? body.lines
          .map((x: any) => ({ article_id: String(x?.article_id || ""), qty: Number(x?.qty || 0) }))
          .filter((x: Line) => x.article_id && Number.isFinite(x.qty) && x.qty > 0)
      : [];

    if (!destinationId || !lines.length) {
      return NextResponse.json({ ok: false, message: "Nedostaje odredište ili stavke prenosa." }, { status: 400 });
    }

    // Za trebovanje proveri status PRE knjiženja da jedan zahtev ne može biti oduzet dva puta.
    if (requestId) {
      const { data: requestRow, error: requestErr } = await admin
        .from("cm_documents")
        .select("id,status,type")
        .eq("id", requestId)
        .eq("type", "TREBOVANJE")
        .maybeSingle();
      if (requestErr) throw requestErr;
      if (!requestRow) throw new Error("Trebovanje nije pronađeno.");
      if (["POSLATO", "PRIMLJENO", "ZAVRSENO"].includes(String(requestRow.status || "").toUpperCase())) {
        throw new Error("Trebovanje je već završeno. Stanje nije ponovo promenjeno.");
      }
    }

    const { data: central, error: centralErr } = await admin
      .from("cm_locations")
      .select("id")
      .eq("type", "CENTRAL")
      .limit(1)
      .single();
    if (centralErr || !central?.id) throw centralErr || new Error("Centralni magacin nije pronađen.");

    // Pre novog pakovanja prvo preračunaj stanje iz kompletne istorije:
    // ULAZI - sva ranije završena/spakovana TREBOVANJA.
    // Tako i stara trebovanja odmah ulaze u stanje i ne mogu se zaboraviti.
    await reconcileCentralStock(admin, String(central.id));

    // Zapamti stanje PRE RPC poziva. Ovo omogućava automatsku korekciju čak i ako je
    // u Supabase-u ostala starija verzija cm_create_transfer funkcije koja ne skida stanje.
    const ids = [...new Set(lines.map((x) => x.article_id))];
    const { data: beforeRows, error: beforeErr } = await admin
      .from("cm_stock")
      .select("article_id,qty")
      .eq("location_id", central.id)
      .in("article_id", ids);
    if (beforeErr) throw beforeErr;

    const before = new Map<string, number>();
    for (const row of beforeRows || []) before.set(String(row.article_id), Number(row.qty || 0));

    // Zapamti i stanje ODREDIŠTA pre prenosa. Posle RPC-a proveravamo obe strane:
    // CENTRALNI mora da bude umanjen, a prodavnica/magacin mora da bude uvećan.
    const { data: destBeforeRows, error: destBeforeErr } = await admin
      .from("cm_stock")
      .select("article_id,qty")
      .eq("location_id", destinationId)
      .in("article_id", ids);
    if (destBeforeErr) throw destBeforeErr;

    const destBefore = new Map<string, number>();
    for (const row of destBeforeRows || []) destBefore.set(String(row.article_id), Number(row.qty || 0));

    for (const line of lines) {
      const current = Number(before.get(line.article_id) || 0);
      if (current < line.qty) {
        throw new Error(`Nema dovoljno robe. Na stanju ${current}, traženo ${line.qty}.`);
      }
    }

    // Postojeći RPC i dalje knjiži dokument, destinaciju i stavke.
    const { data, error } = await admin.rpc("cm_create_transfer", {
      p_user_id: s.id,
      p_destination_id: destinationId,
      p_lines: lines,
      p_request_id: requestId,
    });
    if (error) throw error;

    // Buduće pravilo: čim magacioner potvrdi i završi pakovanje,
    // trebovanje mora eksplicitno da dobije završni status.
    // Ne oslanjamo se samo na staru Supabase RPC funkciju, jer je ranije
    // mogla da proknjiži PRENOS, a da status zahteva ostane "U PRIPREMI".
    if (requestId) {
      const { error: statusFixErr } = await admin
        .from("cm_documents")
        .update({ status: "POSLATO", updated_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("type", "TREBOVANJE");
      if (statusFixErr) throw statusFixErr;
    }

    // SELF-HEAL: proveri da li je centralno stanje stvarno umanjeno.
    // Ako stara DB funkcija nije oduzela robu, API to uradi odmah — bez ručnog SQL-a.
    const { data: afterRows, error: afterErr } = await admin
      .from("cm_stock")
      .select("article_id,qty")
      .eq("location_id", central.id)
      .in("article_id", ids);
    if (afterErr) throw afterErr;

    const after = new Map<string, number>();
    for (const row of afterRows || []) after.set(String(row.article_id), Number(row.qty || 0));

    const { data: destAfterRows, error: destAfterErr } = await admin
      .from("cm_stock")
      .select("article_id,qty")
      .eq("location_id", destinationId)
      .in("article_id", ids);
    if (destAfterErr) throw destAfterErr;

    const destAfter = new Map<string, number>();
    for (const row of destAfterRows || []) destAfter.set(String(row.article_id), Number(row.qty || 0));

    for (const line of lines) {
      const beforeQty = Number(before.get(line.article_id) || 0);
      const expectedQty = Math.max(0, beforeQty - line.qty);
      const afterQty = Number(after.get(line.article_id) ?? beforeQty);

      // CENTRALNI MAGACIN: potvrđeno trebovanje / prenos UVEK oduzima količinu.
      // Ako je RPC već oduzeo, ništa ne diramo. Ako nije, API ispravlja stanje.
      if (afterQty > expectedQty + 0.0001) {
        const { error: fixErr } = await admin
          .from("cm_stock")
          .upsert(
            {
              location_id: central.id,
              article_id: line.article_id,
              qty: expectedQty,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "location_id,article_id" }
          );
        if (fixErr) throw fixErr;
      }

      // ODREDIŠTE: ista potvrđena količina UVEK se dodaje prodavnici/magacinu.
      const destBeforeQty = Number(destBefore.get(line.article_id) || 0);
      const destExpectedQty = destBeforeQty + line.qty;
      const destAfterQty = Number(destAfter.get(line.article_id) ?? destBeforeQty);
      if (destAfterQty < destExpectedQty - 0.0001) {
        const { error: destFixErr } = await admin
          .from("cm_stock")
          .upsert(
            {
              location_id: destinationId,
              article_id: line.article_id,
              qty: destExpectedQty,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "location_id,article_id" }
          );
        if (destFixErr) throw destFixErr;
      }
    }

    return NextResponse.json({ ok: true, data, stock_updated: true, rule: "ULAZ + / POTVRDJENO TREBOVANJE -" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Greška pri prenosu." }, { status: 400 });
  }
}
