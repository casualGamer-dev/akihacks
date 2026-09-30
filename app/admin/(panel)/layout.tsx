import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { sections } from "@/lib/schema";
import { logout } from "../actions";

export default async function Panel({ children }: LayoutProps<"/admin">) {
  const me = await requireAdmin();
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[14rem_1fr]">
      <nav aria-label="Admin" className="text-sm font-bold lg:sticky lg:top-8 lg:self-start">
        <Link href="/admin" className="font-pixel text-2xl">
          AKI Admin
        </Link>
        <ul className="mt-4 space-y-1">
          {Object.entries(sections).map(([id, s]) => (
            <li key={id}>
              <Link href={`/admin/${id}`} className="block py-1 hover:text-orange-ink">
                {s.label.split(" (")[0]}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/admin/media" className="block py-1 hover:text-orange-ink">
              Photos
            </Link>
          </li>
          <li className="pt-2">
            <Link href="/admin/account" className="block py-1 hover:text-orange-ink">
              {me.role === "owner" ? "Admins & account" : "My account"}
            </Link>
          </li>
        </ul>
        <p className="mt-6 break-all text-xs font-normal text-muted">
          {me.email} · {me.role}
        </p>
        <form action={logout} className="mt-2">
          <button className="border-2 border-ink px-3 py-1.5 hover:bg-ink hover:text-paper">Sign out</button>
        </form>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
