import { NextResponse } from "next/server";
import { admin, makeSessionToken, requireSession } from "@/lib/server";

const TREBOVANJE_USERS = new Set([
  "mijatovic.olivera",
  "popovic.milena",
  "cumic.jelena",
  "belic.biljana",
  "ivkovic.sonja",
  "stankovic.jelena",
]);

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    const canBind = s.role === "PRODAVNICA" || TREBOVANJE_USERS.has(String(s.username || "").toLowerCase());
    if (!canBind) {
      return NextResponse.json({ ok: false, message: "Ovaj korisnik ne može da bira prodavnicu." }, { status: 403 });
    }
    if (s.location_code) {
      return NextResponse.json({ ok: false, message: "Prodavnica je već dodeljena ovom korisniku." }, { status: 400 });
    }

    const { location_code } = await req.json();
    const { data: loc, error: locErr } = await admin
      .from("cm_locations")
      .select("code,name")
      .eq("code", String(location_code || ""))
      .eq("type", "STORE")
      .eq("active", true)
      .single();

    if (locErr || !loc) {
      return NextResponse.json({ ok: false, message: "Prodavnica nije pronađena." }, { status: 404 });
    }

    const { error } = await admin.from("cm_users").update({ location_code: loc.code }).eq("id", s.id);
    if (error) throw error;

    const updated = { ...s, location_code: loc.code };
    const token = makeSessionToken(updated);
    const r = NextResponse.json({ ok: true, location: loc });
    r.cookies.set("cm_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return r;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e.message || "Greška" },
      { status: e.message === "UNAUTHORIZED" ? 401 : 400 }
    );
  }
}
