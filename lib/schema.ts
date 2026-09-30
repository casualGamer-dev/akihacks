import type { SectionId } from "./content";

export type Field = {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "email" | "image" | "number" | "strings" | "list";
  fields?: Field[]; // for type "list": the shape of each item
  itemLabel?: string; // for type "list": item title field key
};

const t = (key: string, label: string): Field => ({ key, label, type: "text" });
const url = (key: string, label: string): Field => ({ key, label, type: "url" });
const email = (key: string, label: string): Field => ({ key, label, type: "email" });
const ta = (key: string, label: string): Field => ({ key, label, type: "textarea" });
const img = (key: string, label: string): Field => ({ key, label, type: "image" });
const strs = (key: string, label: string): Field => ({ key, label, type: "strings" });
const list = (key: string, label: string, itemLabel: string, fields: Field[]): Field => ({
  key,
  label,
  type: "list",
  itemLabel,
  fields,
});

export const sections: Record<SectionId, { label: string; path: string; fields: Field[] }> = {
  site: {
    label: "Site-wide (hero, facts, footer, contact, partner)",
    path: "/",
    fields: [
      t("eventLine", "Hero line above the title"),
      t("tagline1", "Tagline, first part"),
      t("tagline2", "Tagline, second part (orange)"),
      ta("heroLead", "Hero paragraph"),
      t("city", "Fact: City"),
      t("month", "Fact: Month"),
      t("date", "Fact: Date"),
      t("venue", "Fact: Venue"),
      ta("footerBlurb", "Footer blurb"),
      email("email", "General email"),
      email("supportEmail", "Support email"),
      url("partnerFormUrl", "'Partner with us' form URL"),
      url("registerUrl", "Register button link (MLH page)"),
      t("registerLabel", "Register button text"),
      t("organizerName", "Organised by (community name)"),
      url("linkedinUrl", "Organiser LinkedIn"),
      url("instagramUrl", "Organiser Instagram"),
    ],
  },
  home: {
    label: "Home page",
    path: "/",
    fields: [
      t("dayZeroTitle", "Day Zero title"),
      strs("dayZeroLines", "Day Zero lines"),
      t("dayZeroPunch", "Day Zero punchline"),
      t("ruleTitle", "Rule box title"),
      ta("ruleBody", "Rule box text"),
      t("pathTitle", "Path section title"),
      ta("pathBody", "Path section text"),
      strs("stages", "Stages (7 fit best)"),
      t("stagesNote", "Stages note"),
      t("focusTitle", "Focus areas title"),
      ta("focusBody", "Focus areas text"),
      strs("focus", "Focus areas"),
      t("communityTitle", "Community title"),
      ta("communityBody", "Community text"),
      ta("communityPunch", "Community closing line"),
      t("communityStat", "Big stat"),
      t("communityStatLabel", "Big stat label"),
      ta("communityQuote", "Press quote / headline"),
      t("communityLinkText", "Press link text"),
      url("communityLinkUrl", "Press link URL"),
      t("closeTitle", "Closing banner title"),
      ta("closeBody", "Closing banner text"),
    ],
  },
  experience: {
    label: "Experience page",
    path: "/experience",
    fields: [
      t("title", "Page title"),
      ta("lead", "Intro"),
      t("twistTitle", "Twist heading"),
      ta("twistBody", "Twist text"),
      ta("twistRule", "Rule callout"),
      t("learnTitle", "Learn heading"),
      list("learn", "What you'll learn", "title", [t("title", "Title"), ta("body", "Text")]),
      t("mentorTitle", "Mentors heading"),
      ta("mentorBody", "Mentors text"),
      strs("mentorAreas", "Mentor areas"),
      t("ctaTitle", "Closing banner title"),
    ],
  },
  journey: {
    label: "Journey page",
    path: "/journey",
    fields: [
      t("title", "Page title"),
      t("lead", "Intro"),
      list("steps", "Steps", "title", [t("title", "Title"), ta("body", "Text"), t("tag", "Side tag (optional)")]),
      t("judgeTitle", "Judging heading"),
      t("judgeBody", "Judging text"),
      list("criteria", "Judging criteria", "name", [
        t("name", "Criterion"),
        { key: "weight", label: "Weight (points)", type: "number" },
      ]),
    ],
  },
  organisers: {
    label: "Organisers",
    path: "/organisers",
    fields: [
      t("title", "Page title"),
      t("lead", "Intro"),
      list("people", "People", "name", [
        t("name", "Name"),
        t("role", "Role"),
        url("url", "Profile link (LinkedIn etc.)"),
        img("photo", "Photo"),
      ]),
    ],
  },
  sponsors: {
    label: "Sponsors & partners",
    path: "/sponsors",
    fields: [
      t("title", "Page title"),
      ta("lead", "Intro"),
      list("others", "Sponsors (shown on the Sponsors page, home page and footer)", "name", [
        t("name", "Name"),
        t("tier", "Tier / label"),
        img("logo", "Logo"),
        url("url", "Website"),
      ]),
      t("moreTitle", "'More partners' title"),
      ta("moreBody", "'More partners' text"),
      t("moreCta", "'More partners' button"),
    ],
  },
  faq: {
    label: "FAQ",
    path: "/faq",
    fields: [t("title", "Page title"), list("items", "Questions", "q", [t("q", "Question"), ta("a", "Answer")])],
  },
  contact: {
    label: "Contact page",
    path: "/contact",
    fields: [
      t("title", "Page title"),
      ta("lead", "Intro"),
      t("generalLabel", "General email label"),
      t("supportLabel", "Support email label"),
    ],
  },
};

const MAX_TEXT = 500;
const MAX_LONG = 5000;
const MAX_ITEMS = 100;

/** Server-side gate for every save: coerces to the schema shape, drops unknown keys, and collects human-readable errors. */
export function clean(fields: Field[], input: unknown, errors: string[] = [], where = ""): { value: Record<string, unknown>; errors: string[] } {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const media = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/`;
  for (const f of fields) {
    const v = src[f.key];
    const label = `${where}${f.label}`;
    if (f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 1000) errors.push(`${label}: enter a number from 0 to 1000.`);
      out[f.key] = Number.isFinite(n) ? Math.min(1000, Math.max(0, n)) : 0;
    } else if (f.type === "strings") {
      const arr = (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean);
      if (arr.length > MAX_ITEMS || arr.some((x) => x.length > MAX_TEXT)) errors.push(`${label}: too many or too long.`);
      out[f.key] = arr.slice(0, MAX_ITEMS).map((x) => x.slice(0, MAX_TEXT));
    } else if (f.type === "list") {
      const arr = Array.isArray(v) ? v : [];
      if (arr.length > MAX_ITEMS) errors.push(`${label}: at most ${MAX_ITEMS} items.`);
      out[f.key] = arr.slice(0, MAX_ITEMS).map((x, i) => clean(f.fields!, x, errors, `${f.label} #${i + 1} → `).value);
    } else {
      const str = typeof v === "string" ? v.trim() : "";
      if (str.length > (f.type === "textarea" ? MAX_LONG : MAX_TEXT)) errors.push(`${label}: too long.`);
      if (str) {
        if (f.type === "url" && !(/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(str) || /^mailto:[^\s@]+@[^\s@]+$/i.test(str) || /^\/(?!\/)\S*$/.test(str)))
          errors.push(`${label}: use a full link starting with https://, or mailto:.`);
        if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) errors.push(`${label}: not a valid email.`);
        if (f.type === "image" && !(/^\/(?!\/)\S*$/.test(str) || str.startsWith(media)))
          errors.push(`${label}: upload the photo here instead of linking to another site.`);
      }
      out[f.key] = str.slice(0, f.type === "textarea" ? MAX_LONG : MAX_TEXT);
    }
  }
  return { value: out, errors };
}
