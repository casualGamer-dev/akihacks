"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Defaults } from "@/lib/content";
import SponsorList from "../SponsorList";
import { STOPS } from "@/lib/journey";
import type { Quality } from "../ValleyScene";
import { Btn, Fact } from "../ui";

const Valley = dynamic(() => import("../ValleyScene"), { ssr: false });

const NAMES = ["Depart", "Day Zero", "How you win", "The path", "Real problems", "Community", "Arrive"];
const LAST = STOPS - 1;

// No backdrop-blur: blurring a live WebGL canvas every frame is what makes the page choppy.
const card =
  "w-full max-w-xl border-2 border-ink bg-paper/95 p-5 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-8 max-h-[calc(100svh-7rem)] overflow-y-auto";
const h2 = "text-2xl font-extrabold leading-tight sm:text-4xl";
const btn =
  "inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold tracking-wide transition-colors";

export default function Story({
  site,
  c,
  sponsors,
  quality,
  onGiveUp,
}: {
  site: Defaults["site"];
  c: Defaults["home"];
  sponsors: Defaults["sponsors"]["others"];
  quality: Quality;
  onGiveUp: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const sail = useRef({ target: 0, onArrive: () => {} });
  const readyRef = useRef(false);
  const [stop, setStop] = useState(0);
  const [moving, setMoving] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(0); // 0..1 while the valley streams in

  useEffect(() => {
    sail.current.onArrive = () => setMoving(false);
    // the journey is one fixed screen: no page scroll or scrollbar while it is shown
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    scrollTo(0, 0);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (stage.current) io.observe(stage.current);
    return () => {
      io.disconnect();
      html.style.overflow = prev;
    };
  }, []);

  const goTo = useCallback((i: number) => {
    if (!readyRef.current || i < 0 || i > LAST || i === sail.current.target) return;
    sail.current.target = i;
    setStop(i);
    setMoving(true);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!visible || e.altKey || e.ctrlKey || e.metaKey || (e.target as Element).closest?.("input,textarea,select")) return;
      if (e.key === "ArrowRight") goTo(sail.current.target + 1);
      if (e.key === "ArrowLeft") goTo(sail.current.target - 1);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [goTo, visible]);

  const controls = (i: number): ReactNode => (
    <div className="mt-6 flex flex-wrap gap-3">
      {i < LAST ? (
        <button
          onClick={() => goTo(i + 1)}
          className={`${btn} bg-orange text-ink hover:bg-ink hover:text-paper`}
        >
          {i === 0 ? "Set sail" : "Next stop"} <span aria-hidden>→</span>
        </button>
      ) : (
        <button onClick={() => goTo(0)} className={`${btn} border-2 border-ink text-ink hover:bg-ink hover:text-paper`}>
          <span aria-hidden>↺</span> Sail again
        </button>
      )}
      {i > 0 && (
        <button
          onClick={() => goTo(i - 1)}
          className={`${btn} border-2 border-ink text-ink hover:bg-ink hover:text-paper`}
        >
          <span aria-hidden>←</span> Back
        </button>
      )}
    </div>
  );

  const stops: ReactNode[] = [
    // 0 · depart
    <div key={0} className="max-w-2xl">
      <p className="text-sm font-bold tracking-wide">{site.eventLine}</p>
      <h1 className="mt-4">
        <span className="sr-only">
          AKI HACKS 2026. {site.tagline1} {site.tagline2}
        </span>
        <span
          aria-hidden
          className="relative block font-pixel text-[clamp(3.25rem,min(12vw,20svh),9rem)] leading-[0.82] tracking-tight"
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
      <p className="mt-6 text-xl font-extrabold leading-tight sm:text-3xl">
        {site.tagline1} <span className="text-orange-ink">{site.tagline2}</span>
      </p>
      <p className="mt-3 max-w-xl text-base font-medium sm:text-lg">{site.heroLead}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => goTo(1)}
          disabled={!ready}
          className={`${btn} bg-orange text-ink hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-60`}
        >
          {ready ? "Set sail" : "Loading…"} <span aria-hidden>→</span>
        </button>
        <Btn href={site.registerUrl} variant="line" external>
          {site.registerLabel}
        </Btn>
      </div>
      <dl className="mt-6 grid max-w-md grid-cols-2 gap-4 border-t-2 border-ink pt-4 [@media(max-height:680px)]:hidden">
        <Fact label="City" value={site.city} />
        <Fact label="Month" value={site.month} />
        <Fact label="Date" value={site.date} />
        <Fact label="Venue" value={site.venue} />
      </dl>
    </div>,

    // 1 · day zero
    <div key={1} className={card}>
      <h2 className="font-pixel text-3xl leading-none sm:text-5xl">{c.dayZeroTitle}</h2>
      <ul className="mt-5 space-y-2 text-base font-bold sm:text-lg">
        {c.dayZeroLines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <p className="mt-4 font-pixel text-3xl text-orange-ink sm:text-4xl">{c.dayZeroPunch}</p>
      {controls(1)}
    </div>,

    // 2 · how you win
    <div key={2} className={card}>
      <p className="text-xs font-bold uppercase tracking-widest text-orange-ink">How you win</p>
      <h2 className={`mt-2 ${h2}`}>{c.ruleTitle}</h2>
      <p className="mt-4 text-muted">{c.ruleBody}</p>
      {controls(2)}
    </div>,

    // 3 · the path
    <div key={3} className={card}>
      <h2 className={h2}>{c.pathTitle}</h2>
      <p className="mt-4 text-muted">{c.pathBody}</p>
      <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {c.stages.map((s, i) => (
          <li
            key={i}
            className={`border-2 border-ink px-3 py-2 ${i === c.stages.length - 1 ? "bg-ink text-paper" : i === 3 ? "bg-orange" : "bg-paper"}`}
          >
            <span className="font-pixel text-lg leading-none">{String(i + 1).padStart(2, "0")}</span>
            <span className="block text-sm font-extrabold">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">{c.stagesNote}</p>
      {controls(3)}
    </div>,

    // 4 · real problems
    <div key={4} className={card}>
      <h2 className={h2}>{c.focusTitle}</h2>
      <p className="mt-4 text-muted">{c.focusBody}</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {c.focus.map((f, i) => (
          <li key={i} className="border-2 border-ink px-3 py-1.5 text-sm font-bold">
            {f}
          </li>
        ))}
      </ul>
      {controls(4)}
    </div>,

    // 5 · community
    <div key={5} className={card}>
      <h2 className={h2}>{c.communityTitle}</h2>
      <p className="mt-4 text-muted">{c.communityBody}</p>
      <p className="mt-3 font-bold">{c.communityPunch}</p>
      <a
        href={c.communityLinkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 block border-2 border-ink p-4 transition-colors hover:bg-ink hover:text-paper"
      >
        {c.communityStat && (
          <>
            <span className="font-pixel text-4xl leading-none text-orange">{c.communityStat}</span>
            <span className="ml-3 text-xs font-bold uppercase tracking-widest">{c.communityStatLabel}</span>
          </>
        )}
        <span className={`${c.communityStat ? "mt-3" : ""} block text-base font-extrabold leading-snug`}>{c.communityQuote}</span>
        <span className="mt-2 block text-sm font-bold underline decoration-orange decoration-2">
          {c.communityLinkText}
        </span>
      </a>
      {controls(5)}
    </div>,

    // 6 · arrive
    <div key={6} className={card}>
      <h2 className="font-pixel text-4xl leading-[0.9] sm:text-6xl">{c.closeTitle}</h2>
      <p className="mt-4 text-base font-semibold sm:text-lg">{c.closeBody}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Btn href={site.registerUrl} external>
          {site.registerLabel}
        </Btn>
        <Btn href="/journey" variant="line">
          See the journey
        </Btn>
      </div>
      <div className="mt-5 border-t-2 border-ink pt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Sponsors</p>
        <SponsorList sponsors={sponsors} className="text-base" />
      </div>
      {controls(6)}
    </div>,
  ];

  return (
    <div ref={stage} className="relative h-svh min-h-[26rem] overflow-hidden bg-[#dfe9f2]">
      {/* poster until the 3D scene is ready */}
      <Image src="/hero.png" alt="" fill priority sizes="100vw" className="object-cover object-[70%_47%]" aria-hidden />
      <div
        aria-hidden
        className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}
      >
        <Valley
            quality={quality}
            paused={!visible}
            onReady={() => {
              readyRef.current = true;
              setReady(true);
            }}
            onProgress={setLoaded}
            onGiveUp={onGiveUp}
            story={sail}
          />
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 hidden transition-opacity duration-700 md:block ${stop === 0 && !moving ? "opacity-100" : "opacity-0"}`}
        style={{ background: "linear-gradient(90deg, rgba(245,245,242,.5), rgba(245,245,242,.1) 45%, transparent 60%)" }}
      />

      {stops.map((node, i) => {
        const on = stop === i && !moving;
        return (
          <div
            key={i}
            inert={!on}
            className={`absolute inset-0 flex items-end px-5 pb-8 pt-20 transition-[opacity,transform] duration-500 ease-out sm:px-8 lg:items-center ${
              on ? "translate-y-0 opacity-100 delay-200" : "pointer-events-none translate-y-4 opacity-0"
            }`}
          >
            <div className={`mx-auto flex w-full max-w-7xl ${i % 2 ? "lg:justify-end" : "lg:justify-start"}`}>{node}</div>
          </div>
        );
      })}

      {!ready && (
        <div
          role="status"
          className="absolute bottom-6 left-1/2 w-56 -translate-x-1/2 bg-paper px-4 py-3 text-xs font-bold"
        >
          Loading the valley…
          <div className="mt-2 h-1.5 bg-line">
            <div className="h-full bg-orange transition-[width] duration-300" style={{ width: `${Math.round(loaded * 100)}%` }} />
          </div>
        </div>
      )}

      {moving && (
        <p
          role="status"
          className="rise pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 bg-paper px-4 py-2 text-sm font-bold"
        >
          Sailing to {NAMES[stop]}…
        </p>
      )}

      <nav aria-label="Journey stops" className="absolute right-3 top-1/2 hidden -translate-y-1/2 flex-col gap-3 sm:flex">
        {NAMES.map((n, i) => (
          <button
            key={n}
            onClick={() => goTo(i)}
            aria-label={n}
            aria-current={stop === i ? "step" : undefined}
            className="group flex items-center justify-end gap-2"
          >
            <span className="bg-paper px-2 py-0.5 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {n}
            </span>
            <span className={`block size-3 border-2 border-ink transition-colors ${stop === i ? "bg-orange" : "bg-paper"}`} />
          </button>
        ))}
      </nav>
    </div>
  );
}
