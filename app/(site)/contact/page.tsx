import type { Metadata } from "next";
import { Page, Section } from "@/components/ui";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Contact" };

export default async function Contact() {
  const [c, site] = await Promise.all([getContent("contact"), getContent("site")]);
  return (
    <Page title={c.title} lead={c.lead}>
      <Section>
        <dl className="space-y-8">
          {[
            [c.generalLabel, site.email],
            [c.supportLabel, site.supportEmail],
          ].map(([label, email]) => (
            <div key={label}>
              <dt className="text-xs font-bold uppercase tracking-widest text-muted">{label}</dt>
              <dd className="mt-1 text-2xl font-extrabold">
                <a href={`mailto:${email}`} className="hover:text-orange-ink">
                  {email}
                </a>
              </dd>
            </div>
          ))}
          {(site.linkedinUrl || site.instagramUrl) && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-widest text-muted">{site.organizerName}</dt>
              <dd className="mt-1 flex gap-6 text-2xl font-extrabold">
                {site.linkedinUrl && (
                  <a href={site.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange-ink">
                    LinkedIn ↗
                  </a>
                )}
                {site.instagramUrl && (
                  <a href={site.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-orange-ink">
                    Instagram ↗
                  </a>
                )}
              </dd>
            </div>
          )}
        </dl>
      </Section>
    </Page>
  );
}
