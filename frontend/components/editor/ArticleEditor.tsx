"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/shared/i18n";
import type { CategoryNode, EditArticle } from "@/lib/types";
import { makeT, msg } from "@/lib/i18n/dictionary";
import { api, uploadFile } from "@/lib/client-api";
import { buttonPrimary, FormAlert, SelectField, TextArea, TextField } from "@/components/forms/Field";
import { RichEditor, type EditorHandle } from "./RichEditor";

type Lang2 = "ta" | "en";
type Form = {
  preferredLanguage: Lang2;
  title: Record<Lang2, string>;
  subtitle: Record<Lang2, string>;
  excerpt: Record<Lang2, string>;
  body: Record<Lang2, string>;
  category: string;
  location: string;
  featuredImage: string;
  featuredUrl: string;
  featuredCaption: Record<Lang2, string>;
  featuredCredit: string;
  sources: { label: string; url: string }[];
  authorNotes: string;
  declaration: boolean;
  // staff
  slug: Record<Lang2, string>;
  seoTitle: Record<Lang2, string>;
  seoDescription: Record<Lang2, string>;
  canonicalUrl: string;
  edition: string;
  authorName: string;
  featured: boolean;
  trending: boolean;
  breaking: boolean;
  priority: number;
};

const blank: Form = {
  preferredLanguage: "ta",
  title: { ta: "", en: "" },
  subtitle: { ta: "", en: "" },
  excerpt: { ta: "", en: "" },
  body: { ta: "", en: "" },
  category: "",
  location: "",
  featuredImage: "",
  featuredUrl: "",
  featuredCaption: { ta: "", en: "" },
  featuredCredit: "",
  sources: [],
  authorNotes: "",
  declaration: false,
  slug: { ta: "", en: "" },
  seoTitle: { ta: "", en: "" },
  seoDescription: { ta: "", en: "" },
  canonicalUrl: "",
  edition: "",
  authorName: "",
  featured: false,
  trending: false,
  breaking: false,
  priority: 0,
};

const fromArticle = (a: EditArticle): Form => ({
  ...blank,
  preferredLanguage: a.preferredLanguage,
  title: a.title,
  subtitle: a.subtitle,
  excerpt: a.excerpt,
  body: a.body,
  category: a.category,
  location: a.location,
  featuredImage: a.featuredImage,
  featuredUrl: a.featuredUrl ?? "",
  featuredCaption: a.featuredCaption,
  featuredCredit: a.featuredCredit,
  sources: a.sources,
  authorNotes: a.authorNotes,
  declaration: a.declaration,
  slug: a.slug,
  seoTitle: a.seoTitle,
  seoDescription: a.seoDescription,
  canonicalUrl: a.canonicalUrl,
  edition: a.edition,
  authorName: a.authorName,
  featured: a.featured,
  trending: a.trending,
  breaking: a.breaking,
  priority: a.priority,
});

const words = (html: string) => {
  const t = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
  return t ? t.split(/\s+/).length : 0;
};

export type EditorHooks = { bodyHandles: Record<Lang2, React.MutableRefObject<EditorHandle | null>>; setBody: (l: Lang2, html: string) => void; setField: (patch: Partial<Form>) => void; form: Form };

export function ArticleEditor({
  lang,
  initial,
  tree,
  maxImages,
  minWords,
  staff = false,
  onHooks,
  afterSubmitHref,
  basePath,
}: {
  lang: Locale; // UI language
  initial: EditArticle | null;
  tree: CategoryNode[];
  maxImages: number;
  minWords: number;
  staff?: boolean;
  onHooks?: (h: EditorHooks) => void;
  /** URL templates containing {id} (functions cannot be passed from server components). */
  afterSubmitHref: string;
  basePath: string;
}) {
  const fill = (tpl: string, id: string) => tpl.replace("{id}", id);
  const t = makeT(lang);
  const router = useRouter();
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [form, setForm] = useState<Form>(initial ? fromArticle(initial) : { ...blank, preferredLanguage: lang });
  const [tab, setTab] = useState<Lang2>(initial?.preferredLanguage ?? lang);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [top, setTop] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [autosaving, setAutosaving] = useState(false);
  const [upload, setUpload] = useState<number | null>(null);
  const dirty = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const handles = { ta: useRef<EditorHandle | null>(null), en: useRef<EditorHandle | null>(null) };
  const editable = initial ? initial.can.edit : true;

  // The message lives at the top of a long form while the buttons are at the bottom: bring it into view.
  useEffect(() => {
    alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [top]);

  const set = useCallback((patch: Partial<Form>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  useEffect(() => {
    onHooks?.({ bodyHandles: handles, setBody: (l, html) => handles[l].current?.setHtml(html), setField: set, form });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, set]);

  const imageCount = useMemo(() => new Set([...(form.body.ta + form.body.en).matchAll(/\/api\/media\/([a-f0-9]{24})\//g)].map((m) => m[1]).concat(form.featuredImage ? [form.featuredImage] : [])).size, [form.body, form.featuredImage]);

  const payload = useCallback(
    () => ({
      title: form.title,
      subtitle: form.subtitle,
      excerpt: form.excerpt,
      body: form.body,
      preferredLanguage: form.preferredLanguage,
      category: form.category || null,
      location: form.location,
      featuredImage: form.featuredImage || null,
      featuredCaption: form.featuredCaption,
      featuredCredit: form.featuredCredit,
      sources: form.sources.filter((s) => s.label || s.url),
      authorNotes: form.authorNotes,
      declaration: form.declaration,
      tags: [],
      ...(staff
        ? { slug: form.slug, seoTitle: form.seoTitle, seoDescription: form.seoDescription, canonicalUrl: form.canonicalUrl, edition: form.edition, authorName: form.authorName, featured: form.featured, trending: form.trending, breaking: form.breaking, priority: form.priority }
        : {}),
    }),
    [form, staff],
  );

  const save = useCallback(
    async (autosave = false): Promise<string | null> => {
      if (!editable) return id;
      if (autosave) setAutosaving(true);
      else {
        setBusy("save");
        setTop(null);
        setErrors({});
      }
      const r = id ? await api<{ id: string }>(`/articles/${id}${autosave ? "?autosave=1" : ""}`, { method: "PUT", body: payload() }) : await api<{ id: string }>("/articles", { body: payload() });
      if (autosave) setAutosaving(false);
      else setBusy(null);
      if (!r.ok) {
        if (!autosave) {
          setErrors(r.fieldErrors ?? {});
          setTop({ kind: "error", text: r.code === "rate_limited" ? t("err.rate_limited") : r.error });
        }
        return null;
      }
      dirty.current = false;
      setSavedAt(new Date());
      if (!id) {
        setId(r.data.id);
        window.history.replaceState(null, "", fill(basePath, r.data.id));
      }
      if (!autosave) setTop({ kind: "ok", text: t("common.saved") });
      return r.data.id;
    },
    [editable, id, payload, t, basePath],
  );

  // Autosave every 30s while there are unsaved changes and something worth saving.
  useEffect(() => {
    if (!editable) return;
    const timer = setInterval(() => {
      if (dirty.current && (form.title.ta || form.title.en || form.body.ta || form.body.en)) void save(true);
    }, 30_000);
    return () => clearInterval(timer);
  }, [editable, form.title, form.body, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  async function submitForReview() {
    const savedId = await save(false);
    if (!savedId) return;
    setBusy("submit");
    const r = await api(`/articles/${savedId}/transition`, { body: { to: "submitted" } });
    setBusy(null);
    if (!r.ok) {
      setErrors(r.fieldErrors ?? {});
      const prefWords = words(form.body[form.preferredLanguage]);
      const text = r.fieldErrors
        ? Object.values(r.fieldErrors)
            .map((c) => (c === "v.min_words" ? `${msg(lang, c)} ${prefWords} / ${minWords}` : msg(lang, c)))
            .join(" ") || r.error
        : r.error;
      return setTop({ kind: "error", text });
    }
    dirty.current = false;
    router.push(fill(afterSubmitHref, savedId));
    router.refresh();
  }

  async function addFeatured(file: File | undefined) {
    if (!file) return;
    setUpload(0);
    const r = await uploadFile(file, setUpload, { credit: form.featuredCredit });
    setUpload(null);
    if (!r.ok) return setErrors((e) => ({ ...e, featuredImage: r.fieldErrors?.file ?? "v.invalid" }));
    setErrors((e) => ({ ...e, featuredImage: "" }));
    set({ featuredImage: r.data.media.id, featuredUrl: r.data.media.url });
  }

  const e = errors;
  const L = tab;
  const wc = words(form.body[L]);
  const flat = tree.flatMap((n) => [{ id: n.id, name: n.name[lang], depth: 0 }, ...n.children.map((c) => ({ id: c.id, name: c.name[lang], depth: 1 }))]);
  const editorLabels = { insertImage: t("submit.insert_image"), uploading: t("submit.uploading"), bold: "Bold", italic: "Italic", h2: "Heading", h3: "Subheading", bullets: "Bulleted list", numbers: "Numbered list", quote: "Quote", link: "Link", undo: "Undo", redo: "Redo" };

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        void save(false);
      }}
      className="space-y-6"
      noValidate
    >
      {!editable && <FormAlert>{t("subs.locked")}</FormAlert>}
      {initial?.reviewNote && initial.status === "changes_requested" && (
        <div className="rounded border border-warn bg-paper2 p-3">
          <p className="font-bold">{t("subs.feedback")}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{initial.reviewNote}</p>
        </div>
      )}
      {top && (
        <div ref={alertRef}>
          <FormAlert kind={top.kind}>{top.text}</FormAlert>
        </div>
      )}

      <SelectField id="preferredLanguage" lang={lang} label={t("submit.lang")} value={form.preferredLanguage} disabled={!editable} onChange={(ev) => set({ preferredLanguage: ev.target.value as Lang2 })}>
        <option value="ta">தமிழ்</option>
        <option value="en">English</option>
      </SelectField>

      <div>
        <div role="tablist" aria-label="Language versions" className="flex gap-1 border-b border-rule">
          {(["ta", "en"] as const).map((l) => {
            const filled = !!form.title[l] && words(form.body[l]) > 0;
            return (
              <button key={l} type="button" role="tab" aria-selected={tab === l} onClick={() => setTab(l)} className={`-mb-px rounded-t border border-b-0 px-4 py-2 font-bold ${tab === l ? "border-rule bg-paper text-brand" : "border-transparent text-ink2 hover:bg-paper2"}`}>
                {t(`submit.tab.${l}` as "submit.tab.ta")} <span className={filled ? "text-ok" : "text-ink3"} aria-label={filled ? "complete" : "empty"}>{filled ? "●" : "○"}</span>
              </button>
            );
          })}
        </div>

        {(["ta", "en"] as const).map((l) => (
          <div key={l} role="tabpanel" hidden={tab !== l} className="space-y-4 pt-4">
            <TextField id={`title-${l}`} lang={lang} label={t("submit.title_label")} value={form.title[l]} maxLength={300} disabled={!editable} onChange={(ev) => set({ title: { ...form.title, [l]: ev.target.value } })} error={e.title ?? e[`title.${l}`]} />
            <TextField id={`subtitle-${l}`} lang={lang} label={t("submit.subtitle_label")} optional={t("common.optional")} value={form.subtitle[l]} maxLength={400} disabled={!editable} onChange={(ev) => set({ subtitle: { ...form.subtitle, [l]: ev.target.value } })} />
            <TextArea id={`excerpt-${l}`} lang={lang} label={t("submit.excerpt_label")} optional={t("common.optional")} rows={2} maxLength={600} value={form.excerpt[l]} disabled={!editable} onChange={(ev) => set({ excerpt: { ...form.excerpt, [l]: ev.target.value } })} />
            <div>
              <label htmlFor={`body-${l}`} className="mb-1 block text-sm font-bold">
                {t("submit.body_label")}
              </label>
              <RichEditor id={`body-${l}`} language={l} lang={lang} value={form.body[l]} disabled={!editable} placeholder={l === "ta" ? "இங்கே கட்டுரையை எழுதுங்கள்…" : "Write the article here…"} onChange={(html) => set({ body: { ...form.body, [l]: html } })} labels={editorLabels} handleRef={handles[l]} />
              {e.body && (
                <p role="alert" className="mt-1 text-sm font-medium text-accent">
                  {msg(lang, e.body)}
                </p>
              )}
            </div>
          </div>
        ))}
        <p className="mt-1 text-xs text-ink3" aria-live="polite">
          {t("submit.words", { n: wc })} · {imageCount}/{maxImages} 🖼
          {!staff && minWords > 0 && (
            <span className={words(form.body[form.preferredLanguage]) >= minWords ? "ml-2 font-bold text-ok" : "ml-2 font-bold text-warn"}>
              · {words(form.body[form.preferredLanguage])} / {minWords} {t("submit.min_words_label")}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="category" lang={lang} label={t("submit.category")} value={form.category} disabled={!editable} onChange={(ev) => set({ category: ev.target.value })} error={e.category} required>
          <option value="">—</option>
          {flat.map((c) => (
            <option key={c.id} value={c.id}>
              {c.depth ? "— " : ""}
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField id="location" lang={lang} label={t("submit.location")} optional={t("common.optional")} value={form.location} maxLength={200} disabled={!editable} onChange={(ev) => set({ location: ev.target.value })} />
      </div>

      <fieldset className="space-y-3 rounded border border-rule p-4" disabled={!editable}>
        <legend className="px-2 font-bold">{t("submit.featured")}</legend>
        <p className="text-xs text-ink3">{t("submit.featured_hint")}</p>
        {form.featuredImage && (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${form.featuredImage}/sm`} alt="" className="h-24 w-36 rounded object-cover" />
            <button type="button" className="text-sm text-accent underline" onClick={() => set({ featuredImage: "", featuredUrl: "" })}>
              {t("submit.remove")}
            </button>
          </div>
        )}
        <div>
          <label htmlFor="featuredFile" className="inline-block cursor-pointer rounded border border-brand px-3 py-2 text-sm font-bold text-brand hover:bg-paper2">
            {upload !== null ? `${t("submit.uploading")} ${upload}%` : t("submit.upload_image")}
          </label>
          <input id="featuredFile" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(ev) => void addFeatured(ev.target.files?.[0])} />
          {e.featuredImage && (
            <p role="alert" className="mt-1 text-sm font-medium text-accent">
              {msg(lang, e.featuredImage)}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id={`fcap-${tab}`} lang={lang} label={`${t("submit.caption")} (${tab === "ta" ? "தமிழ்" : "English"})`} value={form.featuredCaption[tab]} maxLength={500} onChange={(ev) => set({ featuredCaption: { ...form.featuredCaption, [tab]: ev.target.value } })} />
          <TextField id="fcredit" lang={lang} label={t("submit.credit")} value={form.featuredCredit} maxLength={200} onChange={(ev) => set({ featuredCredit: ev.target.value })} />
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded border border-rule p-4" disabled={!editable}>
        <legend className="px-2 font-bold">{t("submit.sources")}</legend>
        {form.sources.map((s, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <TextField id={`src-l-${i}`} lang={lang} label={t("submit.source_label")} value={s.label} onChange={(ev) => set({ sources: form.sources.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)) })} />
            <TextField id={`src-u-${i}`} lang={lang} label={t("submit.source_url")} value={s.url} inputMode="url" onChange={(ev) => set({ sources: form.sources.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)) })} error={e[`sources.${i}.url`]} />
            <button type="button" className="self-end pb-2 text-sm text-accent underline" onClick={() => set({ sources: form.sources.filter((_, j) => j !== i) })}>
              {t("submit.remove")}
            </button>
          </div>
        ))}
        {form.sources.length < 10 && (
          <button type="button" className="text-sm font-bold text-brand" onClick={() => set({ sources: [...form.sources, { label: "", url: "" }] })}>
            + {t("submit.add_source")}
          </button>
        )}
      </fieldset>

      {!staff && (
        <>
          <TextArea id="authorNotes" lang={lang} label={t("submit.notes")} optional={t("common.optional")} rows={3} maxLength={2000} value={form.authorNotes} disabled={!editable} onChange={(ev) => set({ authorNotes: ev.target.value })} />
          <div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={form.declaration} disabled={!editable} onChange={(ev) => set({ declaration: ev.target.checked })} aria-invalid={e.declaration ? true : undefined} />
              <span>{t("submit.declaration")}</span>
            </label>
            {e.declaration && (
              <p role="alert" className="mt-1 text-sm font-medium text-accent">
                {msg(lang, e.declaration)}
              </p>
            )}
          </div>
        </>
      )}

      {staff && (
        <fieldset className="space-y-4 rounded border border-rule p-4" disabled={!editable}>
          <legend className="px-2 font-bold">Publishing &amp; SEO</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id={`slug-${tab}`} lang={lang} label={`URL slug (${tab})`} value={form.slug[tab]} onChange={(ev) => set({ slug: { ...form.slug, [tab]: ev.target.value } })} hint="Leave blank to generate from the headline. Unicode (Tamil) slugs are supported." error={e.slug} />
            <TextField id="canonical" lang={lang} label="Canonical URL" optional="optional" value={form.canonicalUrl} onChange={(ev) => set({ canonicalUrl: ev.target.value })} error={e.canonicalUrl} />
            <TextField id={`seot-${tab}`} lang={lang} label={`SEO title (${tab})`} value={form.seoTitle[tab]} maxLength={120} onChange={(ev) => set({ seoTitle: { ...form.seoTitle, [tab]: ev.target.value } })} />
            <TextField id={`seod-${tab}`} lang={lang} label={`SEO description (${tab})`} value={form.seoDescription[tab]} maxLength={300} onChange={(ev) => set({ seoDescription: { ...form.seoDescription, [tab]: ev.target.value } })} />
            <TextField id="authorName" lang={lang} label="Byline override" optional="optional" value={form.authorName} onChange={(ev) => set({ authorName: ev.target.value })} />
            <TextField id="edition" lang={lang} label="Edition" optional="optional" value={form.edition} onChange={(ev) => set({ edition: ev.target.value })} />
          </div>
          {initial?.can.feature !== false && (
            <div className="flex flex-wrap items-center gap-5 text-sm">
              {(["featured", "trending", "breaking"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 capitalize">
                  <input type="checkbox" className="h-4 w-4" checked={form[k]} onChange={(ev) => set({ [k]: ev.target.checked })} /> {k}
                </label>
              ))}
              <label className="flex items-center gap-2">
                Homepage priority
                <input type="number" min={0} max={100} className="w-20 rounded border border-rule bg-paper px-2 py-1" value={form.priority} onChange={(ev) => set({ priority: Math.max(0, Math.min(100, Number(ev.target.value) || 0)) })} />
              </label>
            </div>
          )}
        </fieldset>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur">
        {editable && (
          <>
            <button type="submit" className="rounded border border-brand px-4 py-2.5 font-bold text-brand hover:bg-paper2 disabled:opacity-60" disabled={busy !== null}>
              {busy === "save" ? t("common.loading") : t("submit.save_draft")}
            </button>
            {!staff && (
              <button type="button" className={buttonPrimary} disabled={busy !== null} onClick={() => void submitForReview()}>
                {busy === "submit" ? t("common.loading") : t("submit.submit")}
              </button>
            )}
          </>
        )}
        {id && (
          <Link href={staff ? `/admin/articles/${id}` : `/${lang}/account/submissions/${id}`} className="text-sm text-brand underline">
            {t("submit.preview")}
          </Link>
        )}
        <span className="ml-auto text-xs text-ink3" aria-live="polite">
          {autosaving ? t("submit.autosaving") : savedAt ? `${t("submit.autosaved")} · ${savedAt.toLocaleTimeString(lang === "ta" ? "ta-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </div>
    </form>
  );
}
