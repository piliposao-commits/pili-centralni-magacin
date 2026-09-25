import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server";

export async function POST() {
  try {
    await requireSession("ADMIN");
    return NextResponse.json(
      {
        ok: false,
        message: "Početno stanje je zaključano na 0. Stanje se računa: UKUPNO ULAZA - POTVRĐENA TREBOVANJA.",
      },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Greška" }, { status: 400 });
  }
}
