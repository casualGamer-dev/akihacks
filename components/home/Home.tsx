"use client";
import { useEffect, useState } from "react";
import type { Defaults } from "@/lib/content";
import type { Quality } from "../ValleyScene";
import StaticHome from "./StaticHome";
import Story from "./Story";

function canWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Server renders the plain sections (SEO, no-JS, reduced motion). With WebGL it upgrades to the boat journey. */
export default function Home({ site, c }: { site: Defaults["site"]; c: Defaults["home"] }) {
  const [quality, setQuality] = useState<Quality | null>(null);

  useEffect(() => {
    // phones and tablets get the image hero + plain sections: lighter and easier to use
    const phone = matchMedia("(pointer: coarse)").matches || innerWidth < 900;
    if (phone || matchMedia("(prefers-reduced-motion: reduce)").matches || !canWebGL()) return;
    const low = (navigator.hardwareConcurrency ?? 8) <= 4;
    const id = requestAnimationFrame(() => setQuality(low ? "low" : "high"));
    return () => cancelAnimationFrame(id);
  }, []);

  return quality ? <Story site={site} c={c} quality={quality} /> : <StaticHome site={site} c={c} />;
}
