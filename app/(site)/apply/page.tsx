import type { Metadata } from "next";
import { Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Apply" };

export default async function Apply() {
  const [c, site] = await Promise.all([getContent("apply"), getContent("site")]);
  const href = c.applyUrl || `mailto:${site.email}?subject=AKI%20HACKS%202026%20applications`;
  return (
    <Page title={c.title} lead={c.lead}>
      <Section>
        <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div className="max-w-xl">
            <h2 className="text-2xl font-extrabold">{c.notifyTitle}</h2>
            <p className="mb-6 mt-3 text-muted">{c.notifyBody}</p>
            <a
              href={href}
              {...(c.applyUrl && { target: "_blank", rel: "noopener noreferrer" })}
              className="inline-flex items-center gap-2 bg-orange px-7 py-4 text-sm font-bold tracking-wide text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              {c.notifyCta} <span aria-hidden>→</span>
            </a>
          </div>
          <aside className="self-start border-2 border-ink p-8">
            <h2 className="text-2xl font-extrabold">{c.soloTitle}</h2>
            <p className="mt-3 text-muted">{c.soloBody}</p>
          </aside>
        </div>
      </Section>
    </Page>
  );
}
