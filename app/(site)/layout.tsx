import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getContent } from "@/lib/content";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const site = await getContent("site");
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-orange focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        Skip to main content
      </a>
      <Nav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer site={site} />
    </>
  );
}
