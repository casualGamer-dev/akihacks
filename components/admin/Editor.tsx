"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getHistory, resetSection, saveSection, uploadImage } from "@/app/admin/actions";
import type { Field } from "@/lib/schema";

type Obj = Record<string, unknown>;
type Version = { id: number; value: Obj; saved_by: string | null; saved_at: string };

const input = "w-full border-2 border-ink bg-paper px-3 py-2 text-base";
const btn = "border-2 border-ink px-3 py-1.5 text-sm font-bold hover:bg-ink hover:text-paper disabled:opacity-50";

function blank(fields: Field[]): Obj {
  return Object.fromEntries(
    fields.map((f) => [f.key, f.type === "list" || f.type === "strings" ? [] : f.type === "number" ? 0 : ""]),
  );
}

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("file", file);
    const r = await uploadImage(fd);
    setBusy(false);
    if (r.url) onChange(r.url);
    else setErr(r.error ?? "Upload failed.");
  }
  return (
    <div className="space-y-2">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview
        <img src={value} alt="" className="max-h-40 border-2 border-ink object-contain" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btn} cursor-pointer`}>
          {busy ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {value && (
          <button type="button" className={btn} onClick={() => onChange("")}>
            Remove
          </button>
        )}
      </div>
      {err && <p className="text-sm font-bold text-red-700">{err}</p>}
    </div>
  );
}

function Strings({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex gap-2">
          <input className={input} value={s} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className={btn} aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={btn} onClick={() => onChange([...value, ""])}>
        + Add
      </button>
    </div>
  );
}

function Fields({ fields, value, onChange }: { fields: Field[]; value: Obj; onChange: (v: Obj) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-5">
      {fields.map((f) => {
        const v = value[f.key];
        const id = `f-${f.key}`;
        return (
          <div key={f.key}>
            <label htmlFor={id} className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted">
              {f.label}
            </label>
            {(f.type === "text" || f.type === "url" || f.type === "email") && (
              <input
                id={id}
                type={f.type === "email" ? "email" : "text"}
                inputMode={f.type === "url" ? "url" : undefined}
                placeholder={f.type === "url" ? "https://…" : undefined}
                className={input}
                value={String(v ?? "")}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.type === "number" && (
              <input id={id} type="number" min={0} max={1000} className={input} value={Number(v ?? 0)} onChange={(e) => set(f.key, e.target.value)} />
            )}
            {f.type === "textarea" && (
              <textarea id={id} rows={4} className={input} value={String(v ?? "")} onChange={(e) => set(f.key, e.target.value)} />
            )}
            {f.type === "image" && <ImageInput value={String(v ?? "")} onChange={(x) => set(f.key, x)} />}
            {f.type === "strings" && <Strings value={(v as string[]) ?? []} onChange={(x) => set(f.key, x)} />}
            {f.type === "list" && <List field={f} value={(v as Obj[]) ?? []} onChange={(x) => set(f.key, x)} />}
          </div>
        );
      })}
    </div>
  );
}

function List({ field, value, onChange }: { field: Field; value: Obj[]; onChange: (v: Obj[]) => void }) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-4">
      {value.map((item, i) => (
        <details key={i} open={value.length <= 3} className="border-2 border-ink">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 bg-paper-2 px-3 py-2 font-bold">
            <span>
              {i + 1}. {String(item[field.itemLabel ?? ""] || "(untitled)")}
            </span>
            <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button type="button" className={btn} aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
              <button type="button" className={btn} aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
              <button
                type="button"
                className={btn}
                onClick={() => {
                  if (confirm("Delete this item?")) onChange(value.filter((_, j) => j !== i));
                }}
              >
                Delete
              </button>
            </span>
          </summary>
          <div className="p-4">
            <Fields fields={field.fields!} value={item} onChange={(x) => onChange(value.map((y, j) => (j === i ? x : y)))} />
          </div>
        </details>
      ))}
      <button type="button" className={btn} onClick={() => onChange([...value, blank(field.fields!)])}>
        + Add item
      </button>
    </div>
  );
}

export default function Editor({
  id,
  fields,
  initial,
  updatedAt,
  path,
}: {
  id: string;
  fields: Field[];
  initial: Obj;
  updatedAt: string | null;
  path: string;
}) {
  const [value, setValue] = useState(initial);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const base = useRef(updatedAt);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [history, setHistory] = useState<Version[] | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(value) !== savedJson;

  // don't lose edits to a stray refresh or tab close
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    start(async () => {
      const r = await saveSection(id, value, base.current);
      if (r.error) return setMsg({ ok: false, text: r.error });
      base.current = r.updatedAt ?? base.current;
      setSavedJson(JSON.stringify(value));
      setMsg({ ok: true, text: r.ok ?? "Saved." });
      setHistory(null);
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-8"
    >
      <Fields fields={fields} value={value} onChange={setValue} />

      {history && (
        <section className="border-2 border-ink p-4">
          <h2 className="font-extrabold">Earlier versions</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-muted">No saved versions yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {new Date(h.saved_at).toLocaleString()} <span className="text-muted">· {h.saved_by ?? "unknown"}</span>
                  </span>
                  <button
                    type="button"
                    className={btn}
                    onClick={() => {
                      setValue(h.value);
                      setMsg({ ok: true, text: "Version loaded. Review it, then Save changes." });
                    }}
                  >
                    Load into editor
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t-2 border-ink bg-paper px-5 py-4 sm:-mx-8 sm:px-8">
        <button disabled={pending || !dirty} className="bg-orange px-6 py-3 text-sm font-bold text-ink hover:bg-ink hover:text-paper disabled:opacity-50">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {dirty && <span className="text-sm font-bold text-orange-ink">Unsaved changes</span>}
        <a href={path} target="_blank" rel="noopener noreferrer" className={btn}>
          View page ↗
        </a>
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => start(async () => setHistory(await getHistory(id)))}
        >
          History
        </button>
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => {
            if (confirm("Discard all edits to this section and go back to the built-in text? (The old version stays in History.)"))
              start(async () => {
                const r = await resetSection(id);
                if (r.error) setMsg({ ok: false, text: r.error });
                else location.reload();
              });
          }}
        >
          Reset to default
        </button>
        {msg && (
          <p role="status" className={`w-full whitespace-pre-line text-sm font-bold ${msg.ok ? "text-green-800" : "text-red-700"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
