import Link from "next/link";
import Image from "next/image";
import { links, Wordmark } from "./site";
import type { Defaults } from "@/lib/content";

export default function Footer({ site }: { site: Defaults["site"] }) {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark className="[&>span:first-child]:text-3xl [&>span:last-child]:text-3xl" />
            <p className="mt-4 max-w-xs text-sm text-paper/70">
              {site.footerBlurb}
            </p>
            <p className="mt-6 text-sm text-paper/70">
              {site.city} · {site.month}
              <br />
              Date: {site.date} · Venue: {site.venue}
            </p>
          </div>

          <nav aria-label="Footer">
            <h2 className="text-xs font-bold uppercase tracking-widest text-paper/50">Explore</h2>
            <ul className="mt-4 space-y-2.5 text-sm font-semibold">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-orange">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/apply" className="hover:text-orange">
                  Apply
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-orange">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-paper/50">Contact</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href={`mailto:${site.email}`} className="hover:text-orange">
                  {site.email}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.supportEmail}`} className="hover:text-orange">
                  {site.supportEmail}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-paper/50">
              {site.partnerLabel}
            </h2>
            <a
              href={site.partnerUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${site.partnerName} (opens in new tab)`}
              className="mt-4 inline-block bg-paper p-2"
            >
              <Image src={site.partnerLogo} alt={site.partnerName} width={56} height={56} className="size-14 object-cover mix-blend-multiply" />
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-col justify-between gap-3 border-t border-line-dark pt-6 text-xs text-paper/60 sm:flex-row">
          <span>© 2026 AKI HACKS. All rights reserved.</span>
          <span>
            <span lang="ja" className="font-jp text-orange">平和</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
