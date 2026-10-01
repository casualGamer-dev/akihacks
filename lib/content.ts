import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";

/** Defaults = the launch copy. DB rows (table site_content) override per section. */
export const defaults = {
  site: {
    eventLine: "First edition · Kolkata · October 2026",
    tagline1: "Build Solutions.",
    tagline2: "Break Barriers.",
    heroLead:
      "Solve a real problem with technology that hasn't been built yet. Ship a working prototype. The most innovative work wins.",
    city: "Kolkata, India",
    month: "October 2026",
    date: "To be announced",
    venue: "To be announced",
    footerBlurb: "Build Solutions. Break Barriers. First edition, India-based, innovation-first.",
    email: "tamanashdas@hotmail.com",
    supportEmail: "support@akihacks.xyz",
    partnerFormUrl: "https://forms.gle/FCEHhPQ8z7gqiyVNA",
    registerUrl: "https://events.mlh.com/events/15462-hacktoberfest-hack-day-kolkata-x-aki-hacks",
    registerLabel: "Register now",
    organizerName: "Caltech Circle",
    linkedinUrl: "https://www.linkedin.com/company/caltech-circle-official",
    instagramUrl: "https://www.instagram.com/caltechcircle/",
  },
  home: {
    dayZeroTitle: "Welcome to Day Zero.",
    dayZeroLines: [
      "Imagine you and your team have a hard problem worth solving.",
      "Imagine the obvious answer already exists.",
      "Imagine the idea only counts if it actually runs.",
      "Imagine you only have a few hours to build it.",
      "Imagine your first approach breaks.",
    ],
    dayZeroPunch: "Now build something new.",
    ruleTitle: "Innovation wins.",
    ruleBody:
      "Judging rewards original, technically strong work above everything else. A working prototype that does something new beats a polished pitch for something familiar. Business viability matters, but it comes second.",
    pathTitle: "This isn't a pitch contest. It's a build contest.",
    pathBody:
      "Real problems from NGOs, foundations and partner organisations working with people with disabilities. The goal isn't a slide deck. It's a working prototype that pushes what's possible.",
    stages: ["Problem", "Team", "Design", "Build", "Test", "Demo", "Judging"],
    stagesNote: "Stage 04 is where it counts: a working build.",
    focusTitle: "Real problems. Not hypothetical prompts.",
    focusBody:
      "AKI HACKS will partner with NGOs and foundations to bring real accessibility problems to participants. Partner announcements are coming soon.",
    focus: [
      "Mobility",
      "Education",
      "Communication",
      "Digital accessibility",
      "Employment",
      "Transportation",
      "Independent living",
      "Assistive technology",
      "Visual accessibility",
      "Hearing accessibility",
      "Public infrastructure",
    ],
    communityTitle: "Before AKI HACKS, we built a community.",
    communityBody:
      "Caltech Circle hosted a two-day experience on March 23–24, 2026, across ZIOKS and Techno India University, bringing together 100+ student developers, creators, and innovators around product-first thinking, structured ideation, and real-world problem solving.",
    communityPunch:
      "That showed us what Kolkata's builders can do when they come together. AKI HACKS is the next chapter.",
    communityStat: "100+",
    communityStatLabel: "builders in the room",
    communityQuote: "Techno Times covered the two-day experience.",
    communityLinkText: "Read the Techno Times story ↗",
    communityLinkUrl:
      "https://technotimes.info/index.php/2026/04/01/tiu-hosts-miro-meetups-kolkata-igniting-a-product-first-innovation-movement/",
    closeTitle: "See you on Day Zero.",
    closeBody:
      "First edition. Kolkata, October 2026. Bring your team of 2–4 and build something new.",
  },
  experience: {
    title: "Build something new.",
    lead: "You're here to build technology that hasn't been built yet. Real problems from NGOs, foundations and partner organisations working with people with disabilities, a working prototype, and judging that rewards innovation above everything else.",
    twistTitle: "Innovation is the point.",
    twistBody:
      "You won't win by pitching the safest idea. Judges look for original approaches, technical depth, and prototypes that actually work. Business viability counts, but it comes second.",
    twistRule: "Innovation carries the most weight. Business viability carries the least.",
    learnTitle: "What you'll get better at.",
    learn: [
      { title: "Rapid prototyping", body: "Turn an idea into something that runs, fast." },
      { title: "Technical depth", body: "Pick the right tools and go deeper than the obvious." },
      { title: "Original thinking", body: "Find an angle nobody else on the floor is taking." },
      { title: "Problem solving", body: "Make decisions with limited information and time." },
      { title: "Adaptability", body: "Change approach when your first design doesn't work." },
      { title: "Demoing", body: "Show clearly what you built and why it's new." },
    ],
    mentorTitle: "You won't be building alone.",
    mentorBody:
      "More than 3 mentors will be available throughout to guide teams, challenge their assumptions and help them through the problems they hit. Mentor announcements are coming soon.",
    mentorAreas: ["Engineering", "Systems", "Design", "Product", "Accessibility", "Demoing"],
    ctaTitle: "Ready for Day Zero?",
  },
  journey: {
    title: "The AKI HACKS journey.",
    lead: "Seven steps: from problem statement to final demo.",
    steps: [
      { title: "Introduction", body: "The host welcomes everyone and covers the event format, rules, judging, and submission criteria.", tag: "" },
      { title: "Speaker session", body: "Innovation, engineering, accessibility, building products, failure, and problem solving.", tag: "Speaker to be announced" },
      { title: "Problem statements", body: "NGO and foundation partners introduce real-world barriers, constraints, and opportunities faced by people with disabilities.", tag: "Real problems" },
      { title: "Plan your build", body: "With your team, pick a problem, choose your approach, and decide what to build. Original approaches score higher than safe ones.", tag: "Innovation first" },
      { title: "Build", body: "Design, prototype, iterate. Split the work, get through technical hurdles, scope changes, and time pressure. Lunch is provided; eat while you build, the sprint doesn't pause.", tag: "Core sprint" },
      { title: "Submit your project", body: "Team roster, problem addressed, solution architecture, working prototype, and demo details.", tag: "Submission forms releasing soon" },
      { title: "Final evaluation", body: "Judged on innovation, technical execution, and impact. Business viability is considered last.", tag: "100 points" },
    ],
    judgeTitle: "How you're judged.",
    judgeBody: "100 points. Bar widths are the real weights.",
    criteria: [
      { name: "Innovation", weight: 30 },
      { name: "Technical execution", weight: 25 },
      { name: "Problem solving", weight: 20 },
      { name: "Problem understanding", weight: 15 },
      { name: "Impact", weight: 10 },
    ],
  },
  organisers: {
    title: "The people behind AKI HACKS.",
    lead: "Every lead. One mission.",
    people: [
      { name: "Soham Das", role: "Lead organiser", url: "https://www.linkedin.com/in/sohamdev77/", photo: "" },
      { name: "Omkar Dutta", role: "Lead organiser", url: "https://www.linkedin.com/in/omkar-dutta-989ba83a9/", photo: "" },
      { name: "S Shreyas", role: "Lead organiser", url: "https://www.linkedin.com/in/s-shreyas-miro/", photo: "" },
      { name: "Subham Saha", role: "Lead organiser", url: "https://www.linkedin.com/in/reaper007/", photo: "" },
      { name: "Tamanash Das", role: "Lead organiser", url: "https://www.linkedin.com/in/toivixd/", photo: "" },
    ],
  },
  sponsors: {
    title: "Sponsors & partners.",
    lead: "Empowering innovation, accessibility, and the next generation of builders in Kolkata.",
    others: [
      { name: "ElevenLabs", tier: "Sponsor", logo: "/sponsors/elevenlabs.svg", url: "https://elevenlabs.io" },
      { name: ".xyz Domains", tier: "Sponsor", logo: "", url: "" },
      { name: "Osen", tier: "Sponsor", logo: "", url: "" },
    ] as { name: string; tier: string; logo: string; url: string }[],
    moreTitle: "More partners, soon.",
    moreBody:
      "We're actively onboarding community organisations, tooling partners, and sponsors. If that could be you, start with the form.",
    moreCta: "Partner with us",
  },
  faq: {
    title: "Questions, answered.",
    items: [
      { q: "Will swag be provided?", a: "Of course." },
      { q: "Will food be provided?", a: "Of course. Food is provided during the event. There's no dedicated lunch break: keep building while you eat." },
      { q: "Will there be mentors?", a: "Yes. More than 3 mentors will be available to guide participants." },
      { q: "Do I need a team?", a: "Yes. Teams are 2 to 4 people and you bring your own. Find teammates in your college or community and apply together." },
      { q: "How are projects judged?", a: "Innovation carries the most weight, followed by technical execution. Business viability is considered too, but it counts least." },
      { q: "Is AKI HACKS a Japanese hackathon?", a: "No. AKI HACKS is an India-based hackathon. Aki / 秋 means autumn in Japanese. We thought “Autumn Hacks” sounded a little boring, so we chose AKI HACKS." },
      { q: "How can I volunteer, or join the core team?", a: "We're building the community around AKI HACKS and will open volunteer and core-team applications. Forms are releasing soon." },
      { q: "When and where is it?", a: "Kolkata, October 2026. Date and venue are to be announced. Register to get updates first." },
    ],
  },
  contact: {
    title: "Need help?",
    lead: "A question, partnership proposal, sponsorship inquiry, accessibility concern, or you just want to talk to us.",
    generalLabel: "General inquiries",
    supportLabel: "Support & accessibility",
  },
};

export type Defaults = typeof defaults;
export type SectionId = keyof Defaults;

const load = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    const { data, error } = await supabase().from("site_content").select("section,value");
    if (error) throw new Error(error.message); // thrown = not cached
    return Object.fromEntries(data.map((r) => [r.section, r.value]));
  },
  ["site_content"],
  { tags: ["content"] },
);

export async function getContent<K extends SectionId>(id: K): Promise<Defaults[K]> {
  const rows = await load().catch((e) => {
    console.error("site_content read failed, using defaults:", e.message);
    return {} as Record<string, unknown>;
  });
  const row = rows[id];
  return { ...defaults[id], ...(row && typeof row === "object" ? row : {}) } as Defaults[K];
}
