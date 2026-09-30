"use client";

import { useState, useTransition } from "react";
import { addUser, changeOwnPassword, deleteUser, resetUserPassword } from "@/app/admin/actions";

type User = { email: string; role: string; created_at: string; last_login: string | null };
type Result = { error?: string; ok?: string };

const input = "w-full border-2 border-ink bg-paper px-3 py-2 text-base";
const btn = "border-2 border-ink px-3 py-1.5 text-sm font-bold hover:bg-ink hover:text-paper disabled:opacity-50";
const primary = "bg-orange px-5 py-2.5 text-sm font-bold text-ink hover:bg-ink hover:text-paper disabled:opacity-50";

function Note({ r }: { r: Result | null }) {
  if (!r) return null;
  return (
    <p role="status" className={`mt-3 text-sm font-bold ${r.error ? "text-red-700" : "text-green-800"}`}>
      {r.error ?? r.ok}
    </p>
  );
}

export function ChangePassword({ managed }: { managed: boolean }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [r, setR] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  if (managed)
    return <p className="text-muted">Your password is set by the ADMIN_PASSWORD environment variable. Change it in your hosting settings.</p>;
  return (
    <form
      className="max-w-sm space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await changeOwnPassword(cur, next);
          setR(res);
          if (res.ok) {
            setCur("");
            setNext("");
          }
        });
      }}
    >
      <input className={input} type="password" placeholder="Current password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
      <input className={input} type="password" placeholder="New password (10+ characters)" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
      <button disabled={pending} className={primary}>
        Change password
      </button>
      <Note r={r} />
    </form>
  );
}

export function UsersPanel({ initial, me }: { initial: User[]; me: string }) {
  const [users, setUsers] = useState(initial);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState("editor");
  const [r, setR] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-10">
      <ul className="divide-y divide-line border-y-2 border-ink">
        {users.length === 0 && <li className="py-4 text-muted">No accounts yet. Add one below.</li>}
        {users.map((u) => (
          <li key={u.email} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <span className="font-bold">{u.email}</span>{" "}
              <span className="text-xs font-bold uppercase tracking-widest text-muted">{u.role}</span>
              <span className="block text-xs text-muted">
                Last sign-in: {u.last_login ? new Date(u.last_login).toLocaleString() : "never"}
              </span>
            </span>
            <span className="flex gap-2">
              <button
                className={btn}
                disabled={pending}
                onClick={() => {
                  const p = prompt(`New password for ${u.email} (10+ characters):`);
                  if (p) start(async () => setR(await resetUserPassword(u.email, p)));
                }}
              >
                Reset password
              </button>
              <button
                className={btn}
                disabled={pending || u.email === me}
                onClick={() => {
                  if (confirm(`Remove ${u.email}? They lose access immediately.`))
                    start(async () => {
                      const res = await deleteUser(u.email);
                      setR(res);
                      if (res.ok) setUsers((x) => x.filter((y) => y.email !== u.email));
                    });
                }}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form
        className="max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addUser(email, pw, role);
            setR(res);
            if (res.ok) {
              setUsers((x) => [...x, { email: email.trim().toLowerCase(), role, created_at: new Date().toISOString(), last_login: null }]);
              setEmail("");
              setPw("");
            }
          });
        }}
      >
        <h2 className="text-xl font-extrabold">Add an admin</h2>
        <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={input} type="password" placeholder="Password (10+ characters)" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <select className={input} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="editor">Editor: can edit content and photos</option>
          <option value="owner">Owner: also manages admins</option>
        </select>
        <button disabled={pending} className={primary}>
          Add admin
        </button>
      </form>
      <Note r={r} />
    </div>
  );
}
