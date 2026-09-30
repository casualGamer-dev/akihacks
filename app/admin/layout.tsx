import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminRoot({ children }: LayoutProps<"/admin">) {
  return children;
}
