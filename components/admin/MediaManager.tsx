"use client";

import { useState, useTransition } from "react";
import { deleteMedia, uploadImage } from "@/app/admin/actions";

type Item = { name: string; url: string; usedIn: string[] };

export default function MediaManager({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [pending, start] = useTransition();

  const upload = (files: FileList | null) =>
    start(async () => {
      setErr("");
      for (const file of Array.from(files ?? [])) {
        const fd = new FormData();
        fd.set("file", file);
        const r = await uploadImage(fd);
        if (r.url) setItems((x) => [{ name: decodeURIComponent(r.url!.split("/").pop()!), url: r.url!, usedIn: [] }, ...x]);
        else setErr(`${file.name}: ${r.error}`);
      }
    });

  return (
    <div>
      <label className="inline-block cursor-pointer bg-orange px-6 py-3 text-sm font-bold text-ink hover:bg-ink hover:text-paper">
        {pending ? "Working…" : "Upload photos"}
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          disabled={pending}
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {err && <p className="mt-3 whitespace-pre-line text-sm font-bold text-red-700">{err}</p>}

      {items.length === 0 ? (
        <p className="mt-8 text-muted">No photos yet.</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((m) => (
            <li key={m.name} className="border-2 border-ink">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin grid */}
              <img src={m.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              <p className="px-2 pt-2 text-xs font-bold text-muted">
                {m.usedIn.length ? `On the site: ${[...new Set(m.usedIn)].join(", ")}` : "Not used yet"}
              </p>
              <div className="flex gap-2 p-2">
                <button
                  className="flex-1 border-2 border-ink px-2 py-1 text-xs font-bold hover:bg-ink hover:text-paper"
                  onClick={async () => {
                    await navigator.clipboard.writeText(m.url);
                    setCopied(m.name);
                  }}
                >
                  {copied === m.name ? "Copied" : "Copy URL"}
                </button>
                <button
                  className="border-2 border-ink px-2 py-1 text-xs font-bold hover:bg-ink hover:text-paper disabled:opacity-40"
                  disabled={m.usedIn.length > 0 || pending}
                  title={m.usedIn.length ? "In use: replace it on the page first" : undefined}
                  onClick={() => {
                    if (confirm("Delete this photo permanently?"))
                      start(async () => {
                        const r = await deleteMedia(m.name);
                        if (r.error) setErr(r.error);
                        else setItems((x) => x.filter((y) => y.name !== m.name));
                      });
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
