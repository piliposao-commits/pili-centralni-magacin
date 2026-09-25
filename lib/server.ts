import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false } }
);

export type Session = {
  id: string;
  username: string;
  full_name: string;
  role: "ADMIN" | "MAGACIONER" | "PRODAVNICA";
  location_code?: string | null;
};

const secret = () => process.env.SESSION_SECRET || "dev-secret-change-me";

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function makeSessionToken(s: Session) {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get("cm_session")?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function requireSession(role?: Session["role"]) {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHORIZED");
  if (role && s.role !== role) throw new Error("FORBIDDEN");
  return s;
}
