import type { Metadata } from "next";
import { Hanken_Grotesk, Noto_Serif_JP, Tiny5 } from "next/font/google";
import "./globals.css";

const body = Hanken_Grotesk({ variable: "--f-body", subsets: ["latin"] });
const pixel = Tiny5({ variable: "--f-pixel", subsets: ["latin"], weight: "400" });
const jp = Noto_Serif_JP({
  variable: "--f-jp",
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://akihacks.xyz"),
  title: {
    default: "AKI HACKS 2026 — Build Solutions. Break Barriers.",
    template: "%s — AKI HACKS 2026",
  },
  description:
    "An India-based, tech-focused hackathon that rewards innovation most. First edition. Kolkata, October 2026.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${pixel.variable} ${jp.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {children}
      </body>
    </html>
  );
}
