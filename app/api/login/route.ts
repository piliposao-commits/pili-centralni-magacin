import { NextResponse } from "next/server";
import { admin, makeSessionToken } from "@/lib/server";

const TREBOVANJE_USERS: Record<string, { full_name: string; location_code: string | null }> = {
  "mijatovic.olivera": { full_name: "Mijatović Olivera", location_code: "BOLJEVCI" },
  "popovic.milena": { full_name: "Popović Milena", location_code: null },
  "cumic.jelena": { full_name: "Ćumić Jelena", location_code: "PILI2" },
  "belic.biljana": { full_name: "Belić Biljana", location_code: "BECMEN" },
  "ivkovic.sonja": { full_name: "Ivković Sonja", location_code: null },
  "stankovic.jelena": { full_name: "Stanković Jelena", location_code: null },
};

const MAGACIONERI: Record<string, { full_name: string; password: string; hash: string }> = {
  "zika": {
    full_name: "Žika",
    password: "deda",
    hash: "$2a$10$8UEbARGq1i2w9O87xXw41utp8ej4Tt6gZM9ZeTtFoXxDZ84ACspRC",
  },
  "goran": {
    full_name: "Goran",
    password: "1234",
    hash: "$2a$10$9eDItBe8fwdjpu9iEqGqwulBa73.O1GtWgxTKPlnQcHjam0piOA0i",
  },
  "magacioner": {
    full_name: "Magacioner",
    password: "magacioner",
    hash: "$2a$10$W3mw10qf4j8AaPXp5QQr.eNCf8XZ677OvmMPkBQG1TYq0ySRNTEjq",
  },
};

const HASH_1234 = "$2a$10$ojomy9mvOF0GNhCJbgTnsO29U0vn1bDD17kkCPRHkNJ3Y.YK5ijxG";

function sessionResponse(user: any) {
  const token = makeSessionToken(user);
  const r = NextResponse.json({ ok: true, user });
  r.cookies.set("cm_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return r;
}

async function upsertPresetUser(username: string, full_name: string, role: "MAGACIONER", hash: string) {
  const { data: existing, error: findErr } = await admin
    .from("cm_users")
    .select("id,username,full_name,role,active,location_code")
    .eq("username", username)
    .maybeSingle();
  if (findErr) throw findErr;

  if (!existing) {
    const { data, error } = await admin
      .from("cm_users")
      .insert({
        username,
        full_name,
        password_hash: hash,
        role,
        active: true,
        location_code: null,
      })
      .select("id,username,full_name,role,location_code")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from("cm_users")
    .update({ full_name, password_hash: hash, role, active: true })
    .eq("id", existing.id)
    .select("id,username,full_name,role,location_code")
    .single();
  if (error) throw error;
  return data;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");

    const mag = MAGACIONERI[username];
    if (mag) {
      if (password !== mag.password) {
        return NextResponse.json({ ok: false, message: "Pogrešan user ili lozinka." }, { status: 401 });
      }
      const dbUser = await upsertPresetUser(username, mag.full_name, "MAGACIONER", mag.hash);
      return sessionResponse({ ...dbUser, role: "MAGACIONER" });
    }

    const preset = TREBOVANJE_USERS[username];
    if (preset) {
      if (password !== "1234") {
        return NextResponse.json({ ok: false, message: "Pogrešan user ili lozinka." }, { status: 401 });
      }

      const { data: existing, error: findErr } = await admin
        .from("cm_users")
        .select("id,username,full_name,role,active,location_code")
        .eq("username", username)
        .maybeSingle();
      if (findErr) throw findErr;

      const wantedLocation = preset.location_code || existing?.location_code || null;
      let dbUser: any = existing;

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

      return sessionResponse({
        id: dbUser.id,
        username,
        full_name: preset.full_name,
        role: "PRODAVNICA",
        location_code: wantedLocation,
      });
    }

    const { data, error } = await admin.rpc("cm_login", {
      p_username: username,
      p_password: password,
    });
    if (error || !data?.ok) {
      return NextResponse.json({ ok: false, message: "Pogrešan user ili lozinka." }, { status: 401 });
    }

    const { data: dbUser } = await admin
      .from("cm_users")
      .select("id,username,full_name,role,location_code")
      .eq("id", data.user.id)
      .single();

    return sessionResponse({ ...data.user, location_code: dbUser?.location_code || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || "Greška pri prijavi." }, { status: 500 });
  }
}
