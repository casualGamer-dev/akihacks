import type { MetadataRoute } from "next";

const routes = ["", "experience", "journey", "organisers", "sponsors", "faq", "apply", "contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((r) => ({ url: `https://akihacks.xyz/${r}` }));
}
