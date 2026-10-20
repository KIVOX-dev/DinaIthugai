"use client";
import { diffWords } from "diff";
import { useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import { FormAlert } from "@/components/forms/Field";
import type { EditorHooks } from "@/components/editor/ArticleEditor";

type Lang = "ta" | "en";
type Result = {
  operation: string;
  original: string;
  output: string;
  alternatives: string[];
  seo?: { title: string; description: string };
  flags: { text: string; reason: string }[];
  warnings: string[];
  provider: string;
  model: string;
  notice: string;
};

const OPS: { id: string; label: string; body?: boolean }[] = [
  { id: "rewrite", label: "Rewrite in newspaper tone", body: true },
  { id: "grammar", label: "Fix grammar & spelling", body: true },
  { id: "structure", label: "Improve paragraph structure", body: true },
  { id: "shorten", label: "Shorten", body: true },
  { id: "lengthen", label: "Expand (no new facts)", body: true },
  { id: "translate", label: "Translate", body: true },
  { id: "sections", label: "Suggest section headings", body: true },
  { id: "headlines", label: "Alternative headlines" },
  { id: "subheadline", label: "Subheadlines" },
  { id: "summary", label: "Summary / excerpt" },
  { id: "seo", label: "SEO title & description" },
];

const toText = (html: string) => html.replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").trim();
const sel = "w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm";

/** Admin/editor-only. Never publishes or overwrites anything by itself: the editor must explicitly accept a suggestion. */
export function AiPanel({ articleId, hooks }: { articleId?: string; hooks: EditorHooks | null }) {
  const [op, setOp] = useState("rewrite");
  const [src, setSrc] = useState<Lang>("en");
  const [tgt, setTgt] = useState<Lang>("en");
  const [tone, setTone] = useState("neutral");
  const [length, setLength] = useState("same");
  const [keepQuotes, setKeepQuotes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const isBody = OPS.find((o) => o.id === op)?.body;
  const diff = useMemo(() => (res && res.operation && ["rewrite", "grammar", "structure", "shorten", "lengthen", "translate", "sections"].includes(res.operation) ? diffWords(toText(res.original), toText(res.output)) : null), [res]);

  async function run() {
    if (!hooks) return;
    const html = hooks.bodyHandles[src].current?.getHtml() ?? hooks.form.body[src];
    const text = html || hooks.form.title[src];
    if (!text.trim()) return setErr(`Write some ${src === "ta" ? "Tamil" : "English"} text first.`);
    setBusy(true);
    setErr(null);
    setRes(null);
    setApplied(null);
    const r = await api<{ result: Result }>("/ai/assist", { body: { operation: op, articleId, title: hooks.form.title[src], text, sourceLang: src, targetLang: op === "translate" ? tgt : src, tone, length, preserveQuotes: keepQuotes } });
    setBusy(false);
    if (!r.ok) return setErr(r.status === 429 ? "AI usage limit reached for this hour. Try again later." : r.error);
    setRes(r.data.result);
  }

  const outLang: Lang = op === "translate" ? tgt : src;
  const f = hooks?.form;

  return (
    <section className="rounded border border-rule bg-paper p-4" aria-labelledby="ai-h">
      <h2 id="ai-h" className="headline text-lg">
        AI assistant
      </h2>
      <p className="text-xs text-ink3">Suggestions only. Review every change before saving; nothing is published automatically.</p>
      <div className="mt-3 space-y-2">
        <label className="block text-xs font-bold">
          Task
          <select className={`${sel} mt-1 font-normal`} value={op} onChange={(e) => setOp(e.target.value)}>
            {OPS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold">
            Source language
            <select className={`${sel} mt-1 font-normal`} value={src} onChange={(e) => setSrc(e.target.value as Lang)}>
              <option value="ta">Tamil</option>
              <option value="en">English</option>
            </select>
          </label>
          {op === "translate" && (
            <label className="block text-xs font-bold">
              Translate to
              <select className={`${sel} mt-1 font-normal`} value={tgt} onChange={(e) => setTgt(e.target.value as Lang)}>
                <option value="ta">Tamil</option>
                <option value="en">English</option>
              </select>
            </label>
          )}
          {isBody && op !== "translate" && (
            <label className="block text-xs font-bold">
              Tone
              <select className={`${sel} mt-1 font-normal`} value={tone} onChange={(e) => setTone(e.target.value)}>
                <option value="neutral">Neutral</option>
                <option value="formal">Formal</option>
                <option value="conversational">Conversational</option>
                <option value="investigative">Investigative</option>
              </select>
            </label>
          )}
        </div>
        {(op === "rewrite" || op === "structure") && (
          <label className="block text-xs font-bold">
            Length
            <select className={`${sel} mt-1 font-normal`} value={length} onChange={(e) => setLength(e.target.value)}>
              <option value="same">Same</option>
              <option value="shorter">Shorter</option>
              <option value="longer">Longer</option>
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={keepQuotes} onChange={(e) => setKeepQuotes(e.target.checked)} className="h-4 w-4" /> Keep quotes and factual details unchanged
        </label>
        <button type="button" onClick={run} disabled={busy || !hooks} className="w-full rounded bg-brand px-3 py-2 text-sm font-bold text-brand-ink disabled:opacity-60">
          {busy ? "Working…" : "Generate suggestion"}
        </button>
      </div>

      {err && (
        <div className="mt-3">
          <FormAlert>{err}</FormAlert>
        </div>
      )}
      {applied && (
        <div className="mt-3">
          <FormAlert kind="ok">{applied}</FormAlert>
        </div>
      )}

      {res && f && (
        <div className="mt-4 space-y-3 border-t border-rule pt-3">
          <p className="rounded border border-warn bg-paper2 p-2 text-xs">⚠ {res.notice}</p>
          {res.warnings.map((w, i) => (
            <p key={i} className="rounded border border-warn p-2 text-xs">
              {w}
            </p>
          ))}

          {diff ? (
            <div>
              <h3 className="mb-1 text-sm font-bold">Before / after</h3>
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded border border-rule bg-paper2 p-2 text-sm" lang={outLang}>
                {diff.map((p, i) => (
                  <span key={i} className={p.added ? "bg-ok/20" : p.removed ? "bg-accent/20 line-through" : ""}>
                    {p.value}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded bg-ok px-3 py-1.5 text-sm font-bold text-white"
                  onClick={() => {
                    hooks!.setBody(outLang, res.output);
                    if (res.operation === "translate" && res.alternatives[0]) hooks!.setField({ title: { ...f.title, [outLang]: res.alternatives[0] } });
                    setApplied(`Applied to the ${outLang === "ta" ? "Tamil" : "English"} version. Review it, then save the draft.`);
                    setRes(null);
                  }}
                >
                  Accept: replace {outLang === "ta" ? "Tamil" : "English"} text
                </button>
                <button type="button" className="rounded border border-rule px-3 py-1.5 text-sm" onClick={() => navigator.clipboard?.writeText(toText(res.output))}>
                  Copy text
                </button>
                <button type="button" className="rounded border border-accent px-3 py-1.5 text-sm text-accent" onClick={() => setRes(null)}>
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-bold">Suggestions</h3>
              {(res.alternatives.length ? res.alternatives : [res.output]).filter(Boolean).map((a, i) => (
                <div key={i} className="rounded border border-rule p-2 text-sm" lang={outLang}>
                  <p>{a}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {res.operation === "headlines" && (
                      <button type="button" className="text-xs font-bold text-brand underline" onClick={() => (hooks!.setField({ title: { ...f.title, [outLang]: a } }), setApplied("Headline applied. Save the draft to keep it."))}>
                        Use as headline
                      </button>
                    )}
                    {res.operation === "subheadline" && (
                      <button type="button" className="text-xs font-bold text-brand underline" onClick={() => (hooks!.setField({ subtitle: { ...f.subtitle, [outLang]: a } }), setApplied("Subheadline applied. Save the draft to keep it."))}>
                        Use as subheadline
                      </button>
                    )}
                    {res.operation === "summary" && (
                      <button type="button" className="text-xs font-bold text-brand underline" onClick={() => (hooks!.setField({ excerpt: { ...f.excerpt, [outLang]: a } }), setApplied("Summary applied. Save the draft to keep it."))}>
                        Use as summary
                      </button>
                    )}
                    <button type="button" className="text-xs underline" onClick={() => navigator.clipboard?.writeText(a)}>
                      Copy
                    </button>
                  </div>
                </div>
              ))}
              {res.seo && (
                <div className="rounded border border-rule p-2 text-sm">
                  <p className="font-bold">{res.seo.title}</p>
                  <p>{res.seo.description}</p>
                  <button
                    type="button"
                    className="mt-1 text-xs font-bold text-brand underline"
                    onClick={() => (hooks!.setField({ seoTitle: { ...f.seoTitle, [outLang]: res.seo!.title }, seoDescription: { ...f.seoDescription, [outLang]: res.seo!.description } }), setApplied("SEO fields applied. Save the draft to keep them."))}
                  >
                    Apply SEO title & description
                  </button>
                </div>
              )}
            </div>
          )}

          {res.flags.length > 0 && (
            <div>
              <h3 className="text-sm font-bold">Verify before publishing</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                {res.flags.map((x, i) => (
                  <li key={i}>
                    <strong>{x.text}</strong> — {x.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-ink3">
            {res.provider} · {res.model}
          </p>
        </div>
      )}
    </section>
  );
}
