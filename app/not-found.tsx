import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-5 px-5">
      <p className="font-pixel text-7xl text-orange">404</p>
      <h1 className="font-pixel text-4xl">Lost on the river.</h1>
      <p className="text-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="w-fit bg-orange px-6 py-3 text-sm font-bold text-ink hover:bg-ink hover:text-paper">
        Back to the start
      </Link>
    </main>
  );
}
