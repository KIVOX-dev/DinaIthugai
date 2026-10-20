"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, uploadFile } from "@/lib/client-api";
import { FormAlert } from "@/components/forms/Field";
import { fmt } from "@/lib/admin-format";

type M = { id: string; url: string; thumb: string; width?: number; height?: number; caption: { ta?: string; en?: string }; credit?: string; visibility: string; size: number; originalName?: string; createdAt: string };
const input = "w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm";

export function MediaLibrary({ items }: { items: M[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [sel, setSel] = useState<M | null>(null);
  const [draft, setDraft] = useState({ en: "", ta: "", credit: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setMsg(null);
    for (const f of Array.from(files)) {
      setProgress(0);
      const r = await uploadFile(f, setProgress);
      if (!r.ok) {
        setProgress(null);
        return setMsg({ kind: "error", text: `${f.name}: ${r.error}` });
      }
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    setMsg({ kind: "ok", text: "Uploaded" });
    router.refresh();
  }

  function open(m: M) {
    setSel(m);
    setDraft({ en: m.caption.en ?? "", ta: m.caption.ta ?? "", credit: m.credit ?? "" });
    setMsg(null);
  }

  async function saveMeta() {
    if (!sel) return;
    const r = await api(`/media/${sel.id}`, { method: "PATCH", body: { caption: { en: draft.en, ta: draft.ta }, credit: draft.credit } });
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setMsg({ kind: "ok", text: "Saved" });
    router.refresh();
  }

  async function replace(files: FileList | null) {
    const f = files?.[0];
    if (!f || !sel) return;
    const fd = new FormData();
    fd.append("file", f);
    const r = await api(`/media/${sel.id}/file`, { method: "PUT", form: fd });
    if (replaceRef.current) replaceRef.current.value = "";
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setMsg({ kind: "ok", text: "File replaced; every article using it now shows the new image." });
    router.refresh();
  }

  async function remove() {
    if (!sel || !window.confirm("Delete this image permanently?")) return;
    const r = await api(`/media/${sel.id}`, { method: "DELETE" });
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setSel(null);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded bg-brand px-4 py-2 text-sm font-bold text-brand-ink">
            Upload images
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void upload(e.target.files)} />
          </label>
          {progress !== null && <span className="text-sm text-ink2">Uploading… {progress}%</span>}
        </div>
        {msg && !sel && <FormAlert kind={msg.kind}>{msg.text}</FormAlert>}
        {items.length === 0 ? (
          <p className="rounded border border-rule bg-paper p-8 text-center text-ink2">No media yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => open(m)} className={`block w-full rounded border bg-paper p-1 text-left ${sel?.id === m.id ? "border-brand" : "border-rule"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.thumb} alt={m.caption.en || m.originalName || ""} loading="lazy" className="aspect-[4/3] w-full rounded object-cover" />
                  <span className="mt-1 block truncate px-1 text-xs">{m.caption.en || m.originalName || m.id}</span>
                  <span className={`block px-1 text-[10px] font-bold uppercase ${m.visibility === "public" ? "text-ok" : "text-ink3"}`}>{m.visibility}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="rounded border border-rule bg-paper p-4 lg:sticky lg:top-4 lg:self-start" aria-label="Selected media">
        {!sel ? (
          <p className="text-sm text-ink2">Select an image to edit its caption and credit, replace the file, or delete it.</p>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sel.url} alt="" className="w-full rounded" />
            <p className="text-xs text-ink3">
              {sel.width}×{sel.height} · {(sel.size / 1024).toFixed(0)} KB · {fmt(sel.createdAt)}
              <br />
              URL: <code className="break-all">{sel.url}</code>
            </p>
            {msg && <FormAlert kind={msg.kind}>{msg.text}</FormAlert>}
            <label className="block text-xs font-bold">
              Caption (English)
              <input className={`${input} mt-1 font-normal`} value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} />
            </label>
            <label className="block text-xs font-bold">
              Caption (தமிழ்)
              <input className={`${input} mt-1 font-normal`} value={draft.ta} onChange={(e) => setDraft({ ...draft, ta: e.target.value })} />
            </label>
            <label className="block text-xs font-bold">
              Photographer / credit
              <input className={`${input} mt-1 font-normal`} value={draft.credit} onChange={(e) => setDraft({ ...draft, credit: e.target.value })} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="rounded bg-brand px-3 py-1.5 text-sm font-bold text-brand-ink" onClick={saveMeta}>
                Save
              </button>
              <label className="cursor-pointer rounded border border-brand px-3 py-1.5 text-sm font-bold text-brand">
                Replace file
                <input ref={replaceRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void replace(e.target.files)} />
              </label>
              <button className="rounded border border-accent px-3 py-1.5 text-sm font-bold text-accent" onClick={remove}>
                Delete
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
