import type { Metadata } from "next";
import Image from "next/image";
import { Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Tracks" };

export default async function Tracks() {
  const c = await getContent("tracks");
  return (
    <Page title={c.title} lead={c.lead}>
      <Section>
        {c.items.length ? (
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {c.items.map((x, i) => (
              <li key={i} className="border-t-2 border-ink pt-5">
                {x.image && (
                  <Image src={x.image} alt="" width={640} height={360} className="mb-5 aspect-video w-full object-cover" />
                )}
                <span className="font-pixel text-3xl leading-none text-orange-ink">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="mt-2 text-2xl font-extrabold">{x.name}</h2>
                <p className="mt-2 text-muted">{x.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-2xl text-lg font-medium text-muted">{c.emptyNote}</p>
        )}
      </Section>
    </Page>
  );
}
