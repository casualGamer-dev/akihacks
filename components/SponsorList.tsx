import Image from "next/image";
import type { Defaults } from "@/lib/content";

type Sponsor = Defaults["sponsors"]["others"][number];

/** Sponsor names (or logos, once uploaded in /admin), each linking to the sponsor's site when it has one. */
export default function SponsorList({ sponsors, className = "" }: { sponsors: Sponsor[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      {sponsors.map((s, i) => {
        const body = s.logo ? (
          <Image src={s.logo} alt={s.name} width={160} height={48} className="h-10 w-auto object-contain" />
        ) : (
          <span className="font-extrabold">{s.name}</span>
        );
        return (
          <li key={i}>
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.name} (opens in new tab)`}
                className="hover:text-orange"
              >
                {body}
              </a>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
