import HeroScene from "@/components/HeroScene";
import { Btn, Fact, Section } from "@/components/ui";
import type { Defaults } from "@/lib/content";
import SponsorList from "@/components/SponsorList";

export default function StaticHome({
  site,
  c,
  sponsors,
}: {
  site: Defaults["site"];
  c: Defaults["home"];
  sponsors: Defaults["sponsors"]["others"];
}) {
  const last = c.stages.length - 1;
  return (
    <>
      {/* HERO: the wordmark at poster scale over the autumn landscape */}
      <section className="relative flex min-h-[min(100svh,58rem)] flex-col overflow-hidden bg-[#dfe9f2]">
        <HeroScene />
        <div className="relative mx-auto w-full max-w-7xl flex-1 px-5 pb-16 pt-28 sm:px-8 sm:pt-32">
          <div>
            <p className="rise text-sm font-bold tracking-wide" style={{ ["--d" as string]: "0ms" }}>
              {site.eventLine}
            </p>

            <h1 className="mt-6">
              <span className="sr-only">
                AKI HACKS 2026. {site.tagline1} {site.tagline2}
              </span>
              <span
                aria-hidden
                className="rise relative block font-pixel text-[clamp(4.25rem,14vw,10.5rem)] leading-[0.82] tracking-tight"
                style={{ ["--d" as string]: "80ms" }}
              >
                AKI
                <span
                  lang="ja"
                  className="absolute -top-[0.02em] left-[2.8ch] font-jp text-[0.92em] font-normal leading-none text-orange sm:left-[3ch]"
                >
                  秋
                </span>
                <br />
                HACKS
              </span>
            </h1>

            <p
              className="rise mt-10 max-w-xl text-2xl font-extrabold leading-tight sm:text-3xl"
              style={{ ["--d" as string]: "200ms" }}
            >
              {site.tagline1} <span className="text-orange-ink">{site.tagline2}</span>
            </p>
            <p
              className="rise mt-4 max-w-xl text-lg font-medium text-ink"
              style={{ ["--d" as string]: "260ms" }}
            >
              {site.heroLead}
            </p>

            <div
              className="rise mt-9 flex flex-col gap-3 sm:flex-row"
              style={{ ["--d" as string]: "320ms" }}
            >
              <Btn href={site.registerUrl} external>
                {site.registerLabel}
              </Btn>
              <Btn href="/experience" variant="line">
                See how it works
              </Btn>
            </div>
          </div>
        </div>

        <dl className="relative bg-ink text-paper [&_dt]:text-paper/60">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-6 sm:px-8 md:grid-cols-4">
            <Fact label="City" value={site.city} />
            <Fact label="Month" value={site.month} />
            <Fact label="Date" value={site.date} />
            <Fact label="Venue" value={site.venue} />
          </div>
        </dl>
      </section>

      {/* DAY ZERO */}
      <Section tone="ink">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="font-pixel text-[clamp(2.5rem,6vw,4.75rem)] leading-none">
              {c.dayZeroTitle}
            </h2>
            <ul className="mt-10 space-y-3 text-xl font-bold sm:text-2xl">
              {c.dayZeroLines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
              <li className="pt-2 font-pixel text-4xl font-normal text-orange sm:text-5xl">
                {c.dayZeroPunch}
              </li>
            </ul>
          </div>

          <div className="self-end border-2 border-paper p-8 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-widest text-orange">How you win</p>
            <h3 className="mt-3 text-3xl font-extrabold leading-tight">{c.ruleTitle}</h3>
            <p className="mt-4 text-paper/75">{c.ruleBody}</p>
            <div className="mt-8">
              <Btn href="/experience" variant="paper">
                The full experience
              </Btn>
            </div>
          </div>
        </div>
      </Section>

      {/* THE PATH: stages as a stair */}
      <Section>
        <div className="max-w-2xl">
          <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">{c.pathTitle}</h2>
          <p className="mt-5 text-lg text-muted">{c.pathBody}</p>
        </div>

        <ol className="mt-14 grid grid-cols-2 items-end gap-x-1 sm:grid-cols-4 lg:grid-cols-7">
          {c.stages.map((s, i) => (
            <li
              key={i}
              className={`flex flex-col justify-between border-2 border-ink p-4 ${
                i === last ? "bg-ink text-paper" : i === 3 ? "bg-orange" : "bg-paper"
              }`}
              style={{ minHeight: `${5 + i * 1.1}rem` }}
            >
              <span className="font-pixel text-2xl leading-none">{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-6 text-base font-extrabold">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">{c.stagesNote}</p>
      </Section>

      {/* REAL PROBLEMS */}
      <Section className="bg-paper-2">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">{c.focusTitle}</h2>
            <p className="mt-5 text-lg text-muted">{c.focusBody}</p>
          </div>
          <ul className="flex flex-wrap content-start gap-2.5">
            {c.focus.map((f, i) => (
              <li key={i} className="border-2 border-ink px-4 py-2 text-base font-bold">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* COMMUNITY ORIGIN */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-4xl font-extrabold leading-tight sm:text-5xl">{c.communityTitle}</h2>
            <p className="mt-5 text-lg text-muted">{c.communityBody}</p>
            <p className="mt-5 text-lg font-bold">{c.communityPunch}</p>
          </div>
          <a
            href={c.communityLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border-2 border-ink p-8 transition-colors hover:bg-ink hover:text-paper sm:p-10"
          >
            {c.communityStat && (
              <>
                <p className="font-pixel text-7xl leading-none text-orange">{c.communityStat}</p>
                <p className="mt-1 text-sm font-bold uppercase tracking-widest">{c.communityStatLabel}</p>
              </>
            )}
            <p className={`${c.communityStat ? "mt-8" : ""} text-2xl font-extrabold leading-snug`}>{c.communityQuote}</p>
            <p className="mt-6 text-sm font-bold underline decoration-orange decoration-2">
              {c.communityLinkText}
            </p>
          </a>
        </div>
      </Section>

      {/* PARTNER + CLOSE */}
      <Section tone="orange">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="font-pixel text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.9]">{c.closeTitle}</h2>
            <p className="mt-5 max-w-xl text-lg font-semibold">{c.closeBody}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Btn href={site.registerUrl} variant="ink" external>
                {site.registerLabel}
              </Btn>
              <Btn href="/journey" variant="line">
                See the journey
              </Btn>
            </div>
          </div>
          <div className="bg-paper p-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">Sponsors</p>
            <SponsorList sponsors={sponsors} className="flex-col !items-start gap-y-1.5 text-lg" />
          </div>
        </div>
      </Section>
    </>
  );
}
