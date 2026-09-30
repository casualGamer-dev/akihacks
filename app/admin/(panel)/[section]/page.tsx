import { notFound } from "next/navigation";
import Editor from "@/components/admin/Editor";
import { defaults, type SectionId } from "@/lib/content";
import { sections } from "@/lib/schema";
import { supabase } from "@/lib/supabase";

export default async function EditSection({ params }: PageProps<"/admin/[section]">) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const id = section as SectionId;
  const s = sections[id];
  // read the row directly (not the site's cache) so the editor always starts from what is really saved
  const { data } = await supabase().from("site_content").select("value,updated_at,updated_by").eq("section", id).maybeSingle();
  const initial = { ...defaults[id], ...(data?.value && typeof data.value === "object" ? data.value : {}) };
  return (
    <>
      <h1 className="font-pixel text-4xl">{s.label}</h1>
      {data && (
        <p className="mt-2 text-sm text-muted">
          Last saved {new Date(data.updated_at).toLocaleString()}
          {data.updated_by ? ` by ${data.updated_by}` : ""}
        </p>
      )}
      <div className="mt-8">
        <Editor
          id={section}
          fields={s.fields}
          initial={initial as Record<string, unknown>}
          updatedAt={data?.updated_at ?? null}
          path={s.path}
        />
      </div>
    </>
  );
}
