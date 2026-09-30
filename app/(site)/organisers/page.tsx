import type { Metadata } from "next";
import Image from "next/image";
import { Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Organisers" };

const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

export default async function Organisers() {
  const c = await getContent("organisers");
  return (
    <Page title={c.title} lead={c.lead}>
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
