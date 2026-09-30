"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-5 px-5">
      <h1 className="font-pixel text-5xl">Something broke.</h1>
      <p className="text-muted">The page hit an error. Try again, or head back to the home page.</p>
      <div className="flex gap-3">
        <button onClick={reset} className="bg-orange px-6 py-3 text-sm font-bold text-ink hover:bg-ink hover:text-paper">
          Try again
        </button>
        <Link href="/" className="border-2 border-ink px-6 py-3 text-sm font-bold hover:bg-ink hover:text-paper">
          Home
        </Link>
      </div>
    </main>
  );
}
