"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { fmt } from "@/lib/admin-format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FormAlert } from "@/components/forms/Field";
import type { EditArticle } from "@/lib/types";

const ACTION: Record<string, { label: string; tone: string; confirm?: string; reason?: boolean }> = {
  submitted: { label: "Submit for review", tone: "bg-brand text-brand-ink" },
  in_review: { label: "Start review", tone: "border border-brand text-brand" },
  approved: { label: "Approve", tone: "bg-ok text-white" },
  changes_requested: { label: "Request changes", tone: "border border-warn text-warn", reason: true },
  rejected: { label: "Reject", tone: "border border-accent text-accent", reason: true, confirm: "Reject this article?" },
  published: { label: "Publish now", tone: "bg-brand text-brand-ink", confirm: "Publish this article to the public site?" },
  scheduled: { label: "Schedule", tone: "border border-brand text-brand" },
  unpublished: { label: "Unpublish", tone: "border border-warn text-warn", confirm: "Remove this article from the public site?" },
  archived: { label: "Archive", tone: "border border-rule text-ink2", confirm: "Archive this article?" },
  draft: { label: "Restore to draft", tone: "border border-rule text-ink2" },
};

type Editor = { id: string; name: string; role: string };

export function WorkflowPanel({ article, allowed, editors }: { article: EditArticle; allowed: string[]; editors: Editor[] }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const needsReason = allowed.some((a) => ACTION[a]?.reason);

  async function go(to: string) {
    const a = ACTION[to];
    if (a?.reason && reason.trim().length < 5) return setMsg({ kind: "error", text: "A reason of at least 5 characters is required." });
    if (to === "scheduled" && !when) return setMsg({ kind: "error", text: "Choose a publication date and time." });
    if (a?.confirm && !window.confirm(a.confirm)) return;
    setBusy(to);
    setMsg(null);
    const r = await api(`/articles/${article.id}/transition`, { body: { to, reason: reason || undefined, scheduledAt: to === "scheduled" ? new Date(when).toISOString() : undefined } });
    setBusy(null);
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setReason("");
    setMsg({ kind: "ok", text: `${a?.label ?? to}: done` });
    router.refresh();
  }

  async function post(path: string, body: unknown, ok: string) {
    setMsg(null);
    const r = await api(`/articles/${article.id}/${path}`, { body });
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setMsg({ kind: "ok", text: ok });
    router.refresh();
    return r;
  }

  return (
    <div className="space-y-5">
      <section className="rounded border border-rule bg-paper p-4">
        <div className="flex items-center justify-between">
          <h2 className="headline text-lg">Workflow</h2>
          <StatusBadge status={article.status} lang="en" />
        </div>
        <p className="mt-1 text-xs text-ink3">
          {article.source === "community" ? `Community submission${article.submitter ? ` by ${article.submitter.name}` : ""}` : "Staff article"} · revision {article.revision}
          {article.scheduledAt && article.status === "scheduled" && ` · goes live ${fmt(article.scheduledAt)}`}
          {article.publishedAt && article.status === "published" && ` · published ${fmt(article.publishedAt)}`}
        </p>
        {msg && (
          <div className="mt-3">
            <FormAlert kind={msg.kind}>{msg.text}</FormAlert>
          </div>
        )}
        {allowed.length === 0 ? (
          <p className="mt-3 text-sm text-ink2">No actions available for you at this stage.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {needsReason && (
              <label className="block text-sm font-bold">
                Reason / comments (required to reject or request changes)
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={2000} className="mt-1 w-full rounded border border-rule bg-paper px-2 py-1.5 font-normal" />
              </label>
            )}
            {allowed.includes("scheduled") && (
              <label className="block text-sm font-bold">
                Publish at (your local time)
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 block rounded border border-rule bg-paper px-2 py-1.5 font-normal" />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {allowed.map((to) => (
                <button key={to} type="button" disabled={busy !== null} onClick={() => go(to)} className={`rounded px-3 py-2 text-sm font-bold disabled:opacity-50 ${ACTION[to]?.tone ?? "border border-rule"}`}>
                  {busy === to ? "…" : (ACTION[to]?.label ?? to)}
                </button>
              ))}
            </div>
            {article.source === "community" && article.status !== "published" && <p className="text-xs text-ink3">Approving does not publish. Publishing is a separate, explicit action.</p>}
          </div>
        )}
      </section>

      {article.can.review && (
        <section className="rounded border border-rule bg-paper p-4">
          <h2 className="headline text-lg">Assignment</h2>
          <p className="text-sm text-ink2">Assigned to: {article.assignedEditor?.name ?? "nobody"}</p>
          <select
            aria-label="Assign editor"
            className="mt-2 w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm"
            value=""
            onChange={(e) => e.target.value && post("assign", { editorId: e.target.value }, "Editor assigned")}
          >
            <option value="">Assign to…</option>
            {editors.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.role.replace("_", " ")})
              </option>
            ))}
          </select>
        </section>
      )}

      {article.can.review && (
        <section className="rounded border border-rule bg-paper p-4">
          <h2 className="headline text-lg">Private notes</h2>
          <p className="text-xs text-ink3">Visible to staff only, never to the author.</p>
          <ul className="my-2 space-y-1 text-sm">
            {article.internalNotes.map((n, i) => (
              <li key={i} className="rounded bg-paper2 p-2">
                {n.note} <span className="text-xs text-ink3">· {fmt(n.at)}</span>
              </li>
            ))}
          </ul>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} aria-label="New private note" className="w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm" />
          <button
            type="button"
            className="mt-1 rounded border border-brand px-3 py-1 text-sm font-bold text-brand"
            onClick={async () => {
              if (!note.trim()) return;
              await post("notes", { note }, "Note added");
              setNote("");
            }}
          >
            Add note
          </button>
        </section>
      )}

      <section className="rounded border border-rule bg-paper p-4">
        <h2 className="headline text-lg">Review history</h2>
        {article.history.length === 0 ? (
          <p className="text-sm text-ink3">No events yet.</p>
        ) : (
          <ol className="mt-2 space-y-2 text-sm">
            {article.history.map((h) => (
              <li key={h.id} className="rounded border border-rule p-2">
                <span className="font-bold capitalize">{h.action.replaceAll("_", " ")}</span> <span className="text-ink3">by {h.by} · {fmt(h.at)}</span>
                {h.reason && <p className="mt-1 whitespace-pre-wrap text-ink2">{h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded border border-rule bg-paper p-4">
        <h2 className="headline text-lg">Revisions</h2>
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm">
          {article.revisions.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded border border-rule p-2">
              <span>
                <strong>#{r.revision}</strong> <span className="capitalize">{r.kind.replace("_", " ")}</span>
                <span className="block text-xs text-ink3">
                  {r.by} · {fmt(r.at)}
                </span>
              </span>
              {article.can.edit && r.revision !== article.revision && (
                <button
                  type="button"
                  className="shrink-0 text-xs font-bold text-brand underline"
                  onClick={async () => {
                    if (!window.confirm(`Restore revision #${r.revision}? Current text becomes a new revision.`)) return;
                    const res = await api(`/articles/${article.id}/revisions/${r.revision}/restore`, { method: "POST", body: {} });
                    if (!res.ok) setMsg({ kind: "error", text: res.error });
                    else router.refresh();
                  }}
                >
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
