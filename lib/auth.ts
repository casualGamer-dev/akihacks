import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "./supabase";

const COOKIE = "admin_session";
const TTL = 60 * 60 * 12; // seconds
const MAX_FAILS = 5;
const WINDOW_MIN = 15;
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export type Role = "owner" | "editor";
export type Session = { email: string; role: Role; env: boolean; exp: number };

const sign = (v: string) => createHmac("sha256", process.env.SESSION_SECRET!).update(v).digest("hex");
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/* ---- passwords ---- */
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `s1$${salt.toString("base64")}$${(await scryptAsync(pw, salt, 64)).toString("base64")}`;
}
async function verifyPassword(pw: string, stored: string) {
  const [v, salt, hash] = stored.split("$");
  if (v !== "s1" || !salt || !hash) return false;
  const got = await scryptAsync(pw, Buffer.from(salt, "base64"), 64);
  const want = Buffer.from(hash, "base64");
  return got.length === want.length && timingSafeEqual(got, want);
}
export const passwordProblem = (pw: string) =>
  pw.length < 10 ? "Use at least 10 characters." : pw.length > 200 ? "Too long." : null;

/* ---- lockout: 5 failures per email+IP per 15 minutes, stored in the DB so it works on serverless ---- */
const since = () => new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
export async function isLocked(key: string) {
  const { count, error } = await supabase()
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("at", since());
  if (error) console.error("login attempts unavailable (run supabase/schema.sql):", error.message);
  return (count ?? 0) >= MAX_FAILS;
}
export const recordFailure = async (key: string) => void (await supabase().from("admin_login_attempts").insert({ key }));
export const clearFailures = async (key: string) => void (await supabase().from("admin_login_attempts").delete().eq("key", key));

/* ---- sign in ---- */
const envOwners = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Returns the identity to put in the session, or null. Always spends similar time so it does not leak which emails exist. */
export async function authenticate(email: string, password: string): Promise<{ email: string; role: Role; env: boolean } | null> {
  email = email.trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD;
  if (pw && envOwners().includes(email) && same(password, pw)) return { email, role: "owner", env: true };

  const { data } = await supabase().from("admin_users").select("email,password_hash,role").eq("email", email).maybeSingle();
  const ok = await verifyPassword(password, data?.password_hash ?? "s1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!data || !ok) return null;
  await supabase().from("admin_users").update({ last_login: new Date().toISOString() }).eq("email", email);
  return { email, role: data.role as Role, env: false };
}

/* ---- session cookie: base64url(json).hmac ---- */
export async function startSession(who: { email: string; role: Role; env: boolean }) {
  const payload = Buffer.from(
    JSON.stringify({ ...who, exp: Math.floor(Date.now() / 1000) + TTL } satisfies Session),
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: TTL,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

export async function getSession(): Promise<Session | null> {
  const [payload, sig] = ((await cookies()).get(COOKIE)?.value ?? "").split(".");
  if (!payload || !sig || !same(sig, sign(payload))) return null;
  let s: Session;
  try {
    s = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!(s.exp > Date.now() / 1000)) return null;
  if (!s.env) {
    // deleted or demoted users lose access immediately, not after the cookie expires
    const { data } = await supabase().from("admin_users").select("role").eq("email", s.email).maybeSingle();
    if (!data) return null;
    s.role = data.role as Role;
  }
  return s;
}

/** Call at the top of every admin page and server action. */
export async function requireAdmin() {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}

export async function requireOwner() {
  const s = await requireAdmin();
  if (s.role !== "owner") redirect("/admin");
  return s;
}
