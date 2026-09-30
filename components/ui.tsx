import Link from "next/link";
import type { ReactNode } from "react";

export function Page({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto max-w-7xl px-5 pb-14 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
          <h1 className="max-w-4xl font-pixel text-[clamp(2.75rem,8vw,6rem)] leading-[0.95] tracking-tight">
            {title}
          </h1>
          {lead && <p className="mt-6 max-w-2xl text-lg font-medium text-muted sm:text-xl">{lead}</p>}
        </div>
      </header>
      {children}
    </>
  );
}

export function Section({
  children,
  tone = "paper",
  className = "",
}: {
  children: ReactNode;
  tone?: "paper" | "ink" | "orange";
  className?: string;
}) {
  const t =
    tone === "ink"
      ? "bg-ink text-paper"
      : tone === "orange"
        ? "bg-orange text-ink"
        : "border-b border-line";
  return (
    <section className={`${t} ${className}`}>
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">{children}</div>
    </section>
  );
}

export function Btn({
  href,
  children,
  variant = "orange",
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: "orange" | "ink" | "line" | "paper";
  external?: boolean;
}) {
  const v = {
    orange: "bg-orange text-ink hover:bg-ink hover:text-paper",
    ink: "bg-ink text-paper hover:bg-orange hover:text-ink",
    paper: "bg-paper text-ink hover:bg-orange",
    line: "border-2 border-ink bg-paper/85 text-ink hover:bg-ink hover:text-paper",
  }[variant];
  const cls = `inline-flex items-center justify-center gap-2 px-7 py-4 text-sm font-bold tracking-wide transition-colors ${v}`;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
      <span aria-hidden>↗</span>
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-widest text-muted">{label}</dt>
      <dd className="mt-1 text-base font-extrabold">{value}</dd>
    </div>
  );
}
