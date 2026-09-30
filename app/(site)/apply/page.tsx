import { redirect } from "next/navigation";
import { getContent } from "@/lib/content";

// Old /apply links keep working: registration lives on MLH.
export default async function Apply() {
  const site = await getContent("site");
  redirect(site.registerUrl);
}
