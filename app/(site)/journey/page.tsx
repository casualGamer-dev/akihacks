import type { Metadata } from "next";
import { Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Journey" };

export default async function Journey() {
  const c = await getContent("journey");
  const total = c.criteria.reduce((a, x) => a + x.weight, 0);
  return (
    <Page title={c.title} lead={c.lead}>
      <Section>
        <ol className="border-t-2 border-ink">
          {c.steps.map((s, i) => (
            <li
              key={i}
              className={`grid gap-3 border-b border-line py-8 md:grid-cols-[5rem_1fr_16rem] md:items-start md:gap-8 ${
                i === 3 ? "bg-paper-2 md:-mx-8 md:px-8" : ""
              }`}
            >
              <span className="font-pixel text-4xl leading-none text-orange-ink">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="text-2xl font-extrabold">{s.title}</h2>
                <p className="mt-2 max-w-2xl text-muted">{s.body}</p>
              </div>
              {s.tag && (
                <p className="text-sm font-bold uppercase tracking-widest text-muted md:text-right">
                  {s.tag}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="ink">
        <h2 className="font-pixel text-4xl leading-none sm:text-6xl">{c.judgeTitle}</h2>
        <p className="mt-4 text-paper/70">{c.judgeBody}</p>
        <div
          className="mt-10 flex h-16 gap-1"
          role="img"
          aria-label={`Scoring weights: ${c.criteria.map((x) => x.weight).join(", ")} of ${total}`}
        >
          {c.criteria.map((x, i) => (
            <div
              key={i}
              style={{ flexGrow: x.weight, flexBasis: 0 }}
              className={`flex items-end p-2 font-pixel text-2xl leading-none text-ink ${
                i % 2 ? "bg-paper" : "bg-orange"
              }`}
            >
              {x.weight}
            </div>
          ))}
        </div>
        <ul className="mt-3 flex gap-1 text-xs font-bold sm:text-sm">
          {c.criteria.map((x, i) => (
            <li key={i} style={{ flexGrow: x.weight, flexBasis: 0 }} className="pr-2">
              {x.name}
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
