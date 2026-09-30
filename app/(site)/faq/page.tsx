import type { Metadata } from "next";
import { Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "FAQ" };

export default async function FAQ() {
  const c = await getContent("faq");
  return (
    <Page title={c.title}>
      <Section>
        <div className="max-w-3xl border-t-2 border-ink">
          {c.items.map(({ q, a }, i) => (
            <details key={i} className="group border-b border-line py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-xl font-extrabold [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  aria-hidden
                  className="font-pixel text-3xl text-orange transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Section>
    </Page>
  );
}
