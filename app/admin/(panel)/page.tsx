import Link from "next/link";
import { sections } from "@/lib/schema";

export default function Dashboard() {
  const cards = [
    ...Object.entries(sections).map(([id, s]) => ({ href: `/admin/${id}`, label: s.label })),
    { href: "/admin/media", label: "Photos (upload & manage)" },
  ];
  return (
    <>
      <h1 className="font-pixel text-4xl">What do you want to change?</h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="block border-2 border-ink p-5 text-lg font-extrabold hover:bg-ink hover:text-paper">
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
