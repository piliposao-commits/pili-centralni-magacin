import { NextResponse } from "next/server";
import { admin, makeSessionToken } from "@/lib/server";

const USERS: Record<string, { full_name: string; location_code: string | null }> = {
  "mijatovic.olivera": { full_name: "Mijatović Olivera", location_code: "BOLJEVCI" },
  "popovic.milena": { full_name: "Popović Milena", location_code: null },
  "cumic.jelena": { full_name: "Ćumić Jelena", location_code: "PILI2" },
  "belic.biljana": { full_name: "Belić Biljana", location_code: "BECMEN" },
  "ivkovic.sonja": { full_name: "Ivković Sonja", location_code: null },
  "stankovic.jelena": { full_name: "Stanković Jelena", location_code: null },
};

// bcrypt hash za 1234
const HASH_1234 = "$2a$10$ojomy9mvOF0GNhCJbgTnsO29U0vn1bDD17kkCPRHkNJ3Y.YK5ijxG";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const preset = USERS[username];

    if (!preset || password !== "1234") {
      return NextResponse.json({ ok: false, message: "Pogrešan user ili lozinka." }, { status: 401 });
    }

    const { data: existing, error: findErr } = await admin
      .from("cm_users")
      .select("id,username,full_name,role,active,location_code")
      .eq("username", username)
      .maybeSingle();
    if (findErr) throw findErr;

    let dbUser: any = existing;
    const wantedLocation = preset.location_code || existing?.location_code || null;

    if (!existing) {
      const { data, error } = await admin
        .from("cm_users")
        .insert({
          username,
          full_name: preset.full_name,
          password_hash: HASH_1234,
          role: "PRODAVNICA",
          active: true,
          location_code: wantedLocation,
        })
        .select("id,username,full_name,role,active,location_code")
        .single();
      if (error) throw error;
      dbUser = data;
    } else {
      const { data, error } = await admin
        .from("cm_users")
        .update({
          full_name: preset.full_name,
          password_hash: HASH_1234,
          role: "PRODAVNICA",
          active: true,
          location_code: wantedLocation,
        })
        .eq("id", existing.id)
        .select("id,username,full_name,role,active,location_code")
        .single();
      if (error) throw error;
      dbUser = data;
    }

    const sessionUser = {
      id: dbUser.id,
      username,
      full_name: preset.full_name,
      role: "PRODAVNICA" as const,
      location_code: wantedLocation,
    };

    const token = makeSessionToken(sessionUser);
    const res = NextResponse.json({ ok: true, user: sessionUser, needs_location: !wantedLocation });
    res.cookies.set("cm_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Greška pri prijavi." }, { status: 500 });
  }
}
