"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Quality } from "./ValleyScene";

const Valley = dynamic(() => import("./ValleyScene"), { ssr: false });

function canWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Live 3D valley behind the hero. The painted photo is the poster and the fallback. */
export default function HeroScene() {
  const box = useRef<HTMLDivElement>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  // Decide tier, then mount three.js only once the page is idle (keeps first paint fast).
  useEffect(() => {
    const coarse = matchMedia("(pointer: coarse)").matches;
    // phones: the painted image only, no WebGL
    if (coarse || innerWidth < 900 || matchMedia("(prefers-reduced-motion: reduce)").matches || !canWebGL()) return;
    const low = (navigator.hardwareConcurrency ?? 8) <= 4;
    const start = () => setQuality(low ? "low" : "high");
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(start, { timeout: 1500 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(start, 400);
    return () => clearTimeout(id);
  }, []);

  // Stop rendering entirely when the hero is scrolled away.
  useEffect(() => {
    if (!box.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} aria-hidden className="absolute inset-0">
      <Image
        src="/hero.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[70%_47%] sm:object-[62%_47%]"
      />
      {quality && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
          <Valley quality={quality} paused={!visible} onReady={() => setReady(true)} />
        </div>
      )}
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(245,245,242,.45), rgba(245,245,242,.1) 38%, transparent 58%)",
        }}
      />
      {ready && (
        <p className="rise pointer-events-none absolute bottom-28 right-5 bg-paper/75 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm sm:right-8">
          Move to brush the grass · click for a gust, or the river
        </p>
      )}
    </div>
  );
}
