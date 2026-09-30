import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getContent } from "@/lib/content";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [site, sponsors] = await Promise.all([getContent("site"), getContent("sponsors")]);
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-orange focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>
      <Nav registerUrl={site.registerUrl} registerLabel={site.registerLabel} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer site={site} sponsors={sponsors.others} />
    </>
  );
}
