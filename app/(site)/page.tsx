import Home from "@/components/home/Home";
import { getContent } from "@/lib/content";

export default async function Page() {
  const [site, home] = await Promise.all([getContent("site"), getContent("home")]);
  return <Home site={site} c={home} />;
}
