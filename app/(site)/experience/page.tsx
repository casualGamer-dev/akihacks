import type { Metadata } from "next";
import { Btn, Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Experience" };

export default async function Experience() {
  const [c, site] = await Promise.all([getContent("experience"), getContent("site")]);
  return (
    <Page title={c.title} lead={c.lead}>
      <Section tone="ink">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="font-pixel text-5xl leading-none text-orange sm:text-6xl">The focus</p>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight">{c.twistTitle}</h2>
          </div>
          <div className="space-y-5 text-lg text-paper/80">
            <p>{c.twistBody}</p>
            <p className="border-2 border-orange p-4 font-bold text-paper">{c.twistRule}</p>
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="text-4xl font-extrabold sm:text-5xl">{c.learnTitle}</h2>
        <dl className="mt-12 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {c.learn.map((l, i) => (
            <div key={i} className="border-t-2 border-ink pt-4">
              <dt className="text-xl font-extrabold">{l.title}</dt>
              <dd className="mt-1 text-muted">{l.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section className="bg-paper-2">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">{c.mentorTitle}</h2>
            <p className="mt-5 text-lg text-muted">{c.mentorBody}</p>
          </div>
          <ul className="flex flex-wrap content-start gap-2.5">
            {c.mentorAreas.map((m, i) => (
              <li key={i} className="border-2 border-ink px-4 py-2 text-base font-bold">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="orange">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <h2 className="font-pixel text-4xl leading-none sm:text-6xl">{c.ctaTitle}</h2>
          <Btn href={site.registerUrl} variant="ink" external>
            {site.registerLabel}
          </Btn>
        </div>
      </Section>
    </Page>
  );
}
