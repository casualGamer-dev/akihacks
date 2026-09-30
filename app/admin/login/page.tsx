"use client";

import { useActionState } from "react";
import { login } from "../actions";

const input = "w-full border-2 border-ink bg-paper px-3 py-2 text-base";
const label = "block text-xs font-bold uppercase tracking-widest text-muted";

export default function Login() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-6 px-5">
      <h1 className="font-pixel text-4xl">Admin</h1>
      <form action={action} className="space-y-4">
        <div>
          <label className={label} htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required autoFocus autoComplete="username" className={`mt-1 ${input}`} />
        </div>
        <div>
          <label className={label} htmlFor="pw">
            Password
          </label>
          <input id="pw" name="password" type="password" required autoComplete="current-password" className={`mt-1 ${input}`} />
        </div>
        {error && (
          <p role="alert" className="text-sm font-bold text-red-700">
            {error}
          </p>
        )}
        <button disabled={pending} className="bg-orange px-6 py-3 text-sm font-bold text-ink hover:bg-ink hover:text-paper disabled:opacity-50">
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
