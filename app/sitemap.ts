import type { MetadataRoute } from "next";

const routes = ["", "experience", "journey", "timeline", "tracks", "organisers", "sponsors", "faq", "contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((r) => ({ url: `https://akihacks.xyz/${r}` }));
}
