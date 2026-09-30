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
        <div className="grid items-center gap-10 border-2 border-ink p-8 sm:p-12 md:grid-cols-[auto_1fr]">
          <Image
            src={site.partnerLogo}
            alt={`${site.partnerName} logo`}
            width={200}
            height={200}
            className="size-40 object-cover mix-blend-multiply"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">
              {site.partnerLabel}
            </p>
            <h2 className="mt-2 text-4xl font-extrabold">{site.partnerName}</h2>
            <div className="mt-6">
              <Btn href={site.partnerUrl} variant="ink" external>
                {c.partnerButton}
              </Btn>
            </div>
          </div>
        </div>

        {c.others.length > 0 && (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {c.others.map((s, i) => {
              const body = (
                <>
                  {s.logo && (
                    <Image
                      src={s.logo}
                      alt={`${s.name} logo`}
                      width={160}
                      height={160}
                      className="size-24 object-contain mix-blend-multiply"
                    />
                  )}
                  {s.tier && (
                    <p className="mt-4 text-xs font-bold uppercase tracking-widest text-orange-ink">
                      {s.tier}
                    </p>
                  )}
                  <p className="mt-1 text-2xl font-extrabold">{s.name}</p>
                </>
              );
              return (
                <li key={i} className="border-2 border-ink">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-6 transition-colors hover:bg-paper-2"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="p-6">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
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
