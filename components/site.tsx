export const links = [
  { href: "/experience", label: "Experience" },
  { href: "/journey", label: "Journey" },
  { href: "/organisers", label: "Organisers" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/faq", label: "FAQ" },
];

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="font-pixel text-[1.35rem] leading-none tracking-wide">AKI HACKS</span>
      <span lang="ja" className="font-jp text-lg font-bold leading-none text-orange">
        秋
      </span>
    </span>
  );
}
