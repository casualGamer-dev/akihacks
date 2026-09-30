import Home from "@/components/home/Home";
import { getContent } from "@/lib/content";

export default async function Page() {
  const [site, home, sponsors] = await Promise.all([getContent("site"), getContent("home"), getContent("sponsors")]);
  return <Home site={site} c={home} sponsors={sponsors.others} />;
}
