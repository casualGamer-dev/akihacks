"use client";
import { useCallback, useEffect, useState } from "react";
import { capable3D } from "@/lib/gpu";
import type { Defaults } from "@/lib/content";
import type { Quality } from "../ValleyScene";
import StaticHome from "./StaticHome";
import Story from "./Story";

/** Server renders the plain sections (SEO, no-JS, reduced motion). With WebGL it upgrades to the boat journey. */
export default function Home({
  site,
  c,
  sponsors,
}: {
  site: Defaults["site"];
  c: Defaults["home"];
  sponsors: Defaults["sponsors"]["others"];
}) {
  const [quality, setQuality] = useState<Quality | null>(null);
  const [still, setStill] = useState(false); // this device can't hold a frame rate: stay on the painted image
  const [canUpgrade, setCanUpgrade] = useState(true); // may measure once whether this device deserves the heavy tier
  // The scene never rebuilds mid-visit (that would mean a second loading screen). A measured verdict is only
  // remembered, and used the next time the page loads.
  const rememberTier = useCallback((q: Quality) => {
    try {
      localStorage.setItem("aki-tier", q);
    } catch {}
  }, []);
  const giveUp = useCallback(() => {
    setQuality(null);
    setStill(true);
  }, []);

  useEffect(() => {
    // phones and tablets get the image hero + plain sections: lighter and easier to use
    const phone = matchMedia("(pointer: coarse)").matches || innerWidth < 900;
    if (phone || matchMedia("(prefers-reduced-motion: reduce)").matches || !capable3D()) return;
    // Start light. Not by core count: browsers such as Brave randomise navigator.hardwareConcurrency per site.
    // The scene measures itself instead (see onTier), and the result is remembered here.
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("aki-tier");
    } catch {}
    const high = location.search.includes("hq") || saved === "high";
    const id = setTimeout(() => {
      setQuality(high ? "high" : "low");
      if (saved === "low") setCanUpgrade(false);
    }, 0); // a timer, not rAF: rAF is paused in background tabs
    return () => clearTimeout(id);
  }, []);

  return quality && !still ? (
    <Story site={site} c={c} sponsors={sponsors} quality={quality} onGiveUp={giveUp} onTier={rememberTier} canUpgrade={canUpgrade} />
  ) : (
    <StaticHome site={site} c={c} sponsors={sponsors} />
  );
}
