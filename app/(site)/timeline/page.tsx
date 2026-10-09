import type { Metadata } from "next";
import { Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Timeline" };

export default async function Timeline() {
  const c = await getContent("timeline");
  return (
    <Page title={c.title} lead={c.lead}>
      <Section>
        {c.items.length ? (
          <ol className="border-t-2 border-ink">
            {c.items.map((x, i) => (
              <li key={i} className="grid gap-2 border-b border-line py-8 md:grid-cols-[14rem_1fr] md:gap-8">
                <p className="font-pixel text-2xl leading-tight text-orange-ink">{x.time}</p>
                <div>
                  <h2 className="text-2xl font-extrabold">{x.title}</h2>
                  {x.body && <p className="mt-2 max-w-2xl text-muted">{x.body}</p>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="max-w-2xl text-lg font-medium text-muted">{c.emptyNote}</p>
        )}
      </Section>
    </Page>
  );
}
