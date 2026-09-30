import type { Metadata } from "next";
import Image from "next/image";
import { Btn, Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Organisers" };

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

export default async function Organisers() {
  const [c, site] = await Promise.all([getContent("organisers"), getContent("site")]);
  return (
    <Page title={c.title} lead={c.lead}>
      <Section className="bg-paper-2">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">Organised by</p>
            <h2 className="mt-1 text-4xl font-extrabold">{site.organizerName}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {site.linkedinUrl && (
              <Btn href={site.linkedinUrl} variant="ink" external>
                LinkedIn
              </Btn>
            )}
            {site.instagramUrl && (
              <Btn href={site.instagramUrl} variant="line" external>
                Instagram
              </Btn>
            )}
          </div>
        </div>
      </Section>
      <Section>
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {c.people.map((p, i) => {
            const card = (
              <>
                {p.photo ? (
                  <Image
                    src={p.photo}
                    alt={p.name}
                    width={640}
                    height={800}
                    className="aspect-[4/5] w-full border-2 border-ink object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className={`grid aspect-[4/5] place-items-center border-2 border-ink font-pixel text-8xl transition-colors group-hover:bg-ink group-hover:text-orange ${
                      i % 2 ? "bg-orange" : "bg-paper-2"
                    }`}
                  >
                    {initials(p.name)}
                  </div>
                )}
                <p className="mt-4 text-2xl font-extrabold">{p.name}</p>
                <p className="text-sm font-bold uppercase tracking-widest text-muted">
                  {p.role}
                  {p.url && " · Profile ↗"}
                </p>
              </>
            );
            return (
              <li key={i}>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="group block">
                    {card}
                  </a>
                ) : (
                  <div className="group">{card}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>
    </Page>
  );
}
