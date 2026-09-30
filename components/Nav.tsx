"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { links, Wordmark } from "./site";

export default function Nav({ registerUrl, registerLabel }: { registerUrl: string; registerLabel: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const overHero = path === "/" && !scrolled && !open;
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        path === "/" ? "-mb-16" : ""
      } ${
        overHero
          ? "border-transparent bg-transparent"
          : "border-line bg-paper/95 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="AKI HACKS home" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              className="text-[13px] font-semibold tracking-wide text-ink underline decoration-transparent decoration-2 underline-offset-8 transition-colors hover:decoration-orange aria-[current=page]:decoration-orange"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={registerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden bg-orange px-5 py-2.5 text-[13px] font-bold tracking-wide text-ink transition-colors hover:bg-ink hover:text-paper sm:inline-flex"
          >
            {registerLabel}
          </a>
          <button
            type="button"
            className="grid size-10 place-items-center border border-ink lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M2 2l14 10M16 2L2 12" />
              ) : (
                <path d="M0 2h18M0 7h18M0 12h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-paper lg:hidden">
          <ul className="mx-auto max-w-7xl px-5 py-3 sm:px-8">
            {links.map((l) => (
              <li key={l.href} className="border-b border-line">
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3.5 text-lg font-bold"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={registerUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block py-3.5 text-lg font-bold text-orange-ink"
              >
                {registerLabel} ↗
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
