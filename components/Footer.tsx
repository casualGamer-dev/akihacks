import Link from "next/link";
import { links, Wordmark } from "./site";
import type { Defaults } from "@/lib/content";
import SponsorList from "./SponsorList";

export default function Footer({ site, sponsors }: { site: Defaults["site"]; sponsors: Defaults["sponsors"]["others"] }) {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark className="[&>span:first-child]:text-3xl [&>span:last-child]:text-3xl" />
            <p className="mt-4 max-w-xs text-sm text-paper/70">
              {site.footerBlurb}
            </p>
            <p className="mt-4 text-sm font-bold">Organised by {site.organizerName}</p>
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
                <a href={site.registerUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange">
                  {site.registerLabel} ↗
                </a>
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
              {site.linkedinUrl && (
                <li>
                  <a href={site.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange">
                    LinkedIn ↗
                  </a>
                </li>
              )}
              {site.instagramUrl && (
                <li>
                  <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange">
                    Instagram ↗
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-paper/50">Sponsors</h2>
            <SponsorList sponsors={sponsors} className="mt-4 flex-col !items-start gap-y-2.5 text-sm" />
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
