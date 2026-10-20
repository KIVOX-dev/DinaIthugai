"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { FormAlert } from "@/components/forms/Field";

type Cat = { id: string; slug: string; name: { ta: string; en: string }; parent: string | null; order: number; showInNav: boolean; enabled: boolean; accent: string };
const input = "w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm";
const blank: Omit<Cat, "id"> = { slug: "", name: { ta: "", en: "" }, parent: null, order: 100, showInNav: true, enabled: true, accent: "" };

export function CategoryManager({ items }: { items: Cat[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Cat | null>(null);
  const [draft, setDraft] = useState<Omit<Cat, "id">>(blank);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const roots = items.filter((c) => !c.parent);

  function edit(c: Cat | null) {
    setEditing(c);
    setDraft(c ? { slug: c.slug, name: c.name, parent: c.parent, order: c.order, showInNav: c.showInNav, enabled: c.enabled, accent: c.accent } : blank);
    setMsg(null);
  }
  async function save() {
    setMsg(null);
    const body = { ...draft, parent: draft.parent || null, accent: draft.accent || "" };
    const r = editing ? await api(`/admin/categories/${editing.id}`, { method: "PUT", body }) : await api("/admin/categories", { body });
    if (!r.ok) return setMsg({ kind: "error", text: r.fieldErrors ? `${r.error} (${Object.keys(r.fieldErrors).join(", ")})` : r.error });
    setMsg({ kind: "ok", text: "Saved" });
    edit(null);
    router.refresh();
  }
  async function remove(c: Cat) {
    if (!window.confirm(`Delete category "${c.name.en || c.name.ta}"?`)) return;
    const r = await api(`/admin/categories/${c.id}`, { method: "DELETE" });
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="overflow-x-auto rounded border border-rule bg-paper">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-paper2 text-xs uppercase text-ink3">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug (URL)</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Nav</th>
              <th className="px-3 py-2">On</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {roots.flatMap((r) => [r, ...items.filter((c) => c.parent === r.id)]).map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2">
                  <span className={c.parent ? "pl-5 text-ink2" : "font-bold"}>
                    {c.parent && "↳ "}
                    {c.name.en || c.name.ta}
                  </span>
                  <span className="block text-xs text-ink3">{c.name.ta}</span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">/{c.slug}</td>
                <td className="px-3 py-2">{c.order}</td>
                <td className="px-3 py-2">{c.showInNav ? "✓" : "—"}</td>
                <td className="px-3 py-2">{c.enabled ? "✓" : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button className="mr-3 text-xs font-bold text-brand underline" onClick={() => edit(c)}>
                    Edit
                  </button>
                  <button className="text-xs font-bold text-accent underline" onClick={() => remove(c)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        className="space-y-3 rounded border border-rule bg-paper p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2 className="headline text-lg">{editing ? "Edit category" : "New category"}</h2>
        {msg && <FormAlert kind={msg.kind}>{msg.text}</FormAlert>}
        <label className="block text-xs font-bold">
          Name (English)
          <input className={`${input} mt-1 font-normal`} value={draft.name.en} onChange={(e) => setDraft({ ...draft, name: { ...draft.name, en: e.target.value } })} />
        </label>
        <label className="block text-xs font-bold">
          Name (தமிழ்)
          <input className={`${input} mt-1 font-normal`} value={draft.name.ta} onChange={(e) => setDraft({ ...draft, name: { ...draft.name, ta: e.target.value } })} />
        </label>
        <label className="block text-xs font-bold">
          URL slug (lowercase letters, numbers, hyphens)
          <input className={`${input} mt-1 font-mono font-normal`} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })} />
        </label>
        <label className="block text-xs font-bold">
          Parent
          <select className={`${input} mt-1 font-normal`} value={draft.parent ?? ""} onChange={(e) => setDraft({ ...draft, parent: e.target.value || null })}>
            <option value="">— top level —</option>
            {roots.filter((r) => r.id !== editing?.id).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name.en || r.name.ta}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold">
            Order
            <input type="number" className={`${input} mt-1 font-normal`} value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 0 })} />
          </label>
          <label className="block text-xs font-bold">
            Accent colour
            <input className={`${input} mt-1 font-mono font-normal`} placeholder="#c8281e" value={draft.accent} onChange={(e) => setDraft({ ...draft, accent: e.target.value })} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.showInNav} onChange={(e) => setDraft({ ...draft, showInNav: e.target.checked })} className="h-4 w-4" /> Show in navigation
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} className="h-4 w-4" /> Enabled
        </label>
        <div className="flex gap-2">
          <button className="rounded bg-brand px-4 py-2 text-sm font-bold text-brand-ink">{editing ? "Save changes" : "Create"}</button>
          {editing && (
            <button type="button" className="rounded border border-rule px-4 py-2 text-sm" onClick={() => edit(null)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
