"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authenticate,
  clearFailures,
  endSession,
  hashPassword,
  isLocked,
  passwordProblem,
  recordFailure,
  requireAdmin,
  requireOwner,
  startSession,
} from "@/lib/auth";
import { clean, sections } from "@/lib/schema";
import { BUCKET, supabase } from "@/lib/supabase";
import type { SectionId } from "@/lib/content";

type Result = { error?: string; ok?: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------- sign in / out ---------------- */

export async function login(_: string | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = ((await headers()).get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const key = `${email}|${ip}`;

  if (await isLocked(key)) return "Too many failed attempts. Try again in 15 minutes.";
  const who = email && password ? await authenticate(email, password) : null;
  if (!who) {
    await recordFailure(key);
    await new Promise((r) => setTimeout(r, 600));
    return "Wrong email or password.";
  }
  await clearFailures(key);
  await startSession(who);
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

/* ---------------- content ---------------- */

const HISTORY_KEEP = 50;

export async function saveSection(
  id: string,
  value: unknown,
  base: string | null,
): Promise<Result & { updatedAt?: string }> {
  const me = await requireAdmin();
  if (!(id in sections)) return { error: "Unknown section." };

  const { value: cleaned, errors } = clean(sections[id as SectionId].fields, value);
  if (errors.length) return { error: errors.slice(0, 6).join("\n") };

  const sb = supabase();
  const { data: cur } = await sb.from("site_content").select("updated_at,updated_by").eq("section", id).maybeSingle();
  if ((cur?.updated_at ?? null) !== base)
    return {
      error: `Someone else saved this section${cur?.updated_by ? ` (${cur.updated_by})` : ""} while you were editing. Reload the page to get their version, then re-apply your changes.`,
    };

  // the DB's own timestamp string is the version token, so the next save compares like with like
  const { data: row, error } = await sb
    .from("site_content")
    .upsert({ section: id, value: cleaned, updated_at: new Date().toISOString(), updated_by: me.email })
    .select("updated_at")
    .single();
  if (error) return { error: error.message };
  const updatedAt = row.updated_at as string;

  await sb.from("site_content_history").insert({ section: id, value: cleaned, saved_by: me.email });
  const { data: old } = await sb
    .from("site_content_history")
    .select("id")
    .eq("section", id)
    .order("saved_at", { ascending: false })
    .range(HISTORY_KEEP, HISTORY_KEEP + 500);
  if (old?.length)
    await sb.from("site_content_history").delete().in("id", old.map((r) => r.id));

  updateTag("content");
  return { ok: "Saved. Live now.", updatedAt };
}

export async function resetSection(id: string): Promise<Result> {
  const me = await requireAdmin();
  if (!(id in sections)) return { error: "Unknown section." };
  const sb = supabase();
  const { data: cur } = await sb.from("site_content").select("value").eq("section", id).maybeSingle();
  if (cur) await sb.from("site_content_history").insert({ section: id, value: cur.value, saved_by: `${me.email} (before reset)` });
  const { error } = await sb.from("site_content").delete().eq("section", id);
  if (error) return { error: error.message };
  updateTag("content");
  return {};
}

export async function getHistory(id: string) {
  await requireAdmin();
  const { data } = await supabase()
    .from("site_content_history")
    .select("id,value,saved_by,saved_at")
    .eq("section", id)
    .order("saved_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

/* ---------------- media ---------------- */

const MAX = 5 * 1024 * 1024;

/** Trust the bytes, not the browser-supplied MIME type. */
function sniff(b: Uint8Array): { type: string; ext: string } | null {
  const is = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (is(0x89, 0x50, 0x4e, 0x47)) return { type: "image/png", ext: "png" };
  if (is(0xff, 0xd8, 0xff)) return { type: "image/jpeg", ext: "jpg" };
  if (is(0x47, 0x49, 0x46, 0x38)) return { type: "image/gif", ext: "gif" };
  if (is(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { type: "image/webp", ext: "webp" };
  return null;
}

export async function uploadImage(form: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "No file." };
  if (file.size > MAX) return { error: "Max 5 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return { error: "Use a PNG, JPEG, WebP or GIF image." };

  const sb = supabase();
  await sb.storage.createBucket(BUCKET, { public: true }); // no-op error if it already exists
  const base = file.name.replace(/\.[^.]*$/, "").replace(/[^\w-]+/g, "_").slice(0, 60) || "image";
  const name = `${Date.now()}-${base}.${kind.ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(name, bytes, { contentType: kind.type });
  if (error) return { error: error.message };
  return { url: sb.storage.from(BUCKET).getPublicUrl(name).data.publicUrl };
}

/** Which sections mention this file? Used to warn before deleting a photo that is on the site. */
async function usage() {
  const { data } = await supabase().from("site_content").select("section,value");
  return (data ?? []).map((r) => ({ section: r.section as string, text: JSON.stringify(r.value) }));
}

export async function listMedia() {
  await requireAdmin();
  const sb = supabase();
  const [{ data }, used] = await Promise.all([
    sb.storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } }),
    usage(),
  ]);
  return (data ?? [])
    .filter((f) => f.id)
    .map((f) => ({
      name: f.name,
      url: sb.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
      usedIn: used.filter((u) => u.text.includes(f.name)).map((u) => sections[u.section as SectionId]?.label.split(" (")[0] ?? u.section),
    }));
}

export async function deleteMedia(name: string): Promise<Result> {
  await requireAdmin();
  const used = (await usage()).filter((u) => u.text.includes(name));
  if (used.length) return { error: `In use on: ${used.map((u) => u.section).join(", ")}. Replace it there first.` };
  const { error } = await supabase().storage.from(BUCKET).remove([name]);
  return error ? { error: error.message } : {};
}

/* ---------------- accounts ---------------- */

export async function listUsers() {
  await requireOwner();
  const { data } = await supabase().from("admin_users").select("email,role,created_at,last_login").order("created_at");
  return data ?? [];
}

export async function addUser(email: string, password: string, role: string): Promise<Result> {
  await requireOwner();
  email = email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter a valid email." };
  const bad = passwordProblem(password);
  if (bad) return { error: bad };
  if (role !== "owner" && role !== "editor") return { error: "Bad role." };
  const { error } = await supabase()
    .from("admin_users")
    .insert({ email, password_hash: await hashPassword(password), role });
  if (error) return { error: error.code === "23505" ? "That email already has an account." : error.message };
  return { ok: `Added ${email}.` };
}

export async function deleteUser(email: string): Promise<Result> {
  const me = await requireOwner();
  if (email === me.email) return { error: "You can't remove yourself." };
  const { error } = await supabase().from("admin_users").delete().eq("email", email);
  return error ? { error: error.message } : { ok: `Removed ${email}.` };
}

export async function resetUserPassword(email: string, password: string): Promise<Result> {
  await requireOwner();
  const bad = passwordProblem(password);
  if (bad) return { error: bad };
  const { error } = await supabase()
    .from("admin_users")
    .update({ password_hash: await hashPassword(password) })
    .eq("email", email);
  return error ? { error: error.message } : { ok: `Password changed for ${email}.` };
}

export async function changeOwnPassword(current: string, next: string): Promise<Result> {
  const me = await requireAdmin();
  if (me.env) return { error: "Your password comes from the ADMIN_PASSWORD environment variable. Change it there." };
  const bad = passwordProblem(next);
  if (bad) return { error: bad };
  if (!(await authenticate(me.email, current))) return { error: "Current password is wrong." };
  const { error } = await supabase()
    .from("admin_users")
    .update({ password_hash: await hashPassword(next) })
    .eq("email", me.email);
  return error ? { error: error.message } : { ok: "Password changed." };
}
