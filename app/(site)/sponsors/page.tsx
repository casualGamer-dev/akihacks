import type { Metadata } from "next";
import Image from "next/image";
import { Btn, Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Sponsors & Partners" };

export default async function Sponsors() {
  const [c, site] = await Promise.all([getContent("sponsors"), getContent("site")]);
  return (
    <Page title={c.title} lead={c.lead}>
      <Section>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {c.others.map((s, i) => {
            const body = (
              <>
                {s.logo && (
                  <Image
                    src={s.logo}
                    alt={`${s.name} logo`}
                    width={240}
                    height={120}
                    className="mb-5 h-20 w-auto max-w-full object-contain"
                  />
                )}
                {s.tier && (
                  <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">{s.tier}</p>
                )}
                <p className="mt-1 text-3xl font-extrabold">{s.name}</p>
                {s.url && <p className="mt-4 text-sm font-bold">Visit ↗</p>}
              </>
            );
            return (
              <li key={i} className="border-2 border-ink">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-8 transition-colors hover:bg-paper-2"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="p-8">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section tone="ink">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="font-pixel text-4xl leading-none sm:text-6xl">{c.moreTitle}</h2>
            <p className="mt-4 max-w-xl text-paper/75">{c.moreBody}</p>
          </div>
          <Btn href={site.partnerFormUrl} external>
            {c.moreCta}
          </Btn>
        </div>
      </Section>
    </Page>
  );
}
