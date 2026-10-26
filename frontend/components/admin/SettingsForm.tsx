"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, uploadFile } from "@/lib/client-api";
import { FormAlert } from "@/components/forms/Field";
import { STATIC_PAGES, STATIC_SLUGS, type StaticSlug } from "@/lib/i18n/pages";

type L = { ta?: string | null; en?: string | null };
export type SettingsData = {
  siteName: L;
  tagline: L;
  edition: L;
  social: Record<string, string | null | undefined>;
  contact: { email?: string | null; phone?: string | null; address?: L };
  registrationOpen: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: L;
  breakingBanner: { enabled: boolean; label: L };
  submissions: { enabled: boolean; requireVerifiedEmail: boolean; maxImagesPerArticle: number; minWords: number; rules?: L };
  uploads: { maxMb: number; allowedTypes: string[] };
  ai: { enabled: boolean; hourlyLimitPerUser: number };
  priorityRegions?: string[];
  customHeadlines?: { text?: string | null; href?: string | null; enabled?: boolean; order?: number }[];
  homepageSections: { key?: string | null; enabled?: boolean; order?: number; limit?: number }[];
  footerLinks: { label?: L; href?: string | null }[];
  staticPages: Record<string, L>;
};
export type AdItem = { id: string; slot: string; name: string; imageMedia: string; href: string; alt: string; enabled: boolean; locales: string[] };

const input = "w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm";
const SLOTS = ["header_leaderboard", "home_sidebar", "home_inline", "article_inline", "article_sidebar", "footer_banner"];

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="space-y-3 rounded border border-rule bg-paper p-4">
      <legend className="headline px-2 text-lg">{title}</legend>
      {hint && <p className="text-xs text-ink3">{hint}</p>}
      {children}
    </fieldset>
  );
}
const Txt = ({ label, value, onChange, type = "text", ...r }: { label: string; value: string | number; onChange: (v: string) => void; type?: string } & Record<string, unknown>) => (
  <label className="block text-xs font-bold">
    {label}
    <input type={type} className={`${input} mt-1 font-normal`} value={value} onChange={(e) => onChange(e.target.value)} {...r} />
  </label>
);
const Chk = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" className="h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
  </label>
);

export function SettingsForm({ initial, ads, categories }: { initial: SettingsData; ads: AdItem[]; categories: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [s, setS] = useState<SettingsData>({ ...initial, social: initial.social ?? {}, contact: initial.contact ?? {}, staticPages: initial.staticPages ?? {}, homepageSections: initial.homepageSections ?? [], priorityRegions: initial.priorityRegions ?? [], customHeadlines: initial.customHeadlines ?? [], footerLinks: initial.footerLinks ?? [] });
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageSlug, setPageSlug] = useState<StaticSlug>("about");
  const set = <K extends keyof SettingsData>(k: K, v: SettingsData[K]) => setS((p) => ({ ...p, [k]: v }));
  const loc = (v?: L) => ({ ta: v?.ta ?? "", en: v?.en ?? "" });

  async function save() {
    setBusy(true);
    setMsg(null);
    const body = {
      siteName: loc(s.siteName),
      tagline: loc(s.tagline),
      edition: loc(s.edition),
      social: Object.fromEntries(Object.entries(s.social).map(([k, v]) => [k, v ?? ""])),
      contact: { email: s.contact.email ?? "", phone: s.contact.phone ?? "", address: loc(s.contact.address) },
      registrationOpen: s.registrationOpen,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: loc(s.maintenanceMessage),
      breakingBanner: { enabled: s.breakingBanner.enabled, label: loc(s.breakingBanner.label) },
      submissions: { ...s.submissions, rules: loc(s.submissions.rules) },
      uploads: s.uploads,
      ai: s.ai,
      priorityRegions: (s.priorityRegions ?? []).filter(Boolean),
      customHeadlines: (s.customHeadlines ?? []).filter((h) => h.text?.trim()).map((h) => ({ text: h.text!.trim(), href: (h.href ?? "").trim(), enabled: h.enabled !== false, order: h.order ?? 100 })),
      homepageSections: s.homepageSections.filter((h) => h.key).map((h) => ({ key: h.key!, enabled: h.enabled !== false, order: h.order ?? 100, limit: h.limit ?? 5 })),
      footerLinks: s.footerLinks.filter((f) => f.href).map((f) => ({ label: loc(f.label), href: f.href! })),
      staticPages: Object.fromEntries(Object.entries(s.staticPages).filter(([, v]) => v.ta || v.en).map(([k, v]) => [k, loc(v)])),
    };
    const r = await api("/admin/settings", { method: "PUT", body });
    setBusy(false);
    if (!r.ok) return setMsg({ kind: "error", text: r.fieldErrors ? `${r.error} (${Object.keys(r.fieldErrors).join(", ")})` : r.error });
    setMsg({ kind: "ok", text: "Settings saved" });
    router.refresh();
  }

  const page = s.staticPages[pageSlug] ?? {};
  return (
    <div className="space-y-5">
      {msg && <FormAlert kind={msg.kind}>{msg.text}</FormAlert>}

      <Section title="Branding">
        <div className="grid gap-3 sm:grid-cols-2">
          <Txt label="Newspaper name (தமிழ்)" value={s.siteName.ta ?? ""} onChange={(v) => set("siteName", { ...s.siteName, ta: v })} />
          <Txt label="Newspaper name (English)" value={s.siteName.en ?? ""} onChange={(v) => set("siteName", { ...s.siteName, en: v })} />
          <Txt label="Tagline (தமிழ்)" value={s.tagline.ta ?? ""} onChange={(v) => set("tagline", { ...s.tagline, ta: v })} />
          <Txt label="Tagline (English)" value={s.tagline.en ?? ""} onChange={(v) => set("tagline", { ...s.tagline, en: v })} />
          <Txt label="Edition (தமிழ்)" value={s.edition.ta ?? ""} onChange={(v) => set("edition", { ...s.edition, ta: v })} />
          <Txt label="Edition (English)" value={s.edition.en ?? ""} onChange={(v) => set("edition", { ...s.edition, en: v })} />
        </div>
      </Section>

      <Section title="Contact & social links" hint="Social icons appear in the header and footer only for links you fill in.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Txt label="Contact email" value={s.contact.email ?? ""} onChange={(v) => set("contact", { ...s.contact, email: v })} />
          <Txt label="Contact phone" value={s.contact.phone ?? ""} onChange={(v) => set("contact", { ...s.contact, phone: v })} />
          <Txt label="Address (தமிழ்)" value={s.contact.address?.ta ?? ""} onChange={(v) => set("contact", { ...s.contact, address: { ...s.contact.address, ta: v } })} />
          <Txt label="Address (English)" value={s.contact.address?.en ?? ""} onChange={(v) => set("contact", { ...s.contact, address: { ...s.contact.address, en: v } })} />
          {["facebook", "x", "instagram", "youtube", "whatsapp"].map((k) => (
            <Txt key={k} label={`${k[0].toUpperCase()}${k.slice(1)} URL`} value={s.social[k] ?? ""} onChange={(v) => set("social", { ...s.social, [k]: v })} placeholder="https://" />
          ))}
        </div>
      </Section>

      <Section title="Site behaviour">
        <Chk label="Open user registration" checked={s.registrationOpen} onChange={(v) => set("registrationOpen", v)} />
        <Chk label="Show breaking-news ticker" checked={s.breakingBanner.enabled} onChange={(v) => set("breakingBanner", { ...s.breakingBanner, enabled: v })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Txt label="Ticker label (தமிழ்)" value={s.breakingBanner.label?.ta ?? ""} onChange={(v) => set("breakingBanner", { ...s.breakingBanner, label: { ...s.breakingBanner.label, ta: v } })} />
          <Txt label="Ticker label (English)" value={s.breakingBanner.label?.en ?? ""} onChange={(v) => set("breakingBanner", { ...s.breakingBanner, label: { ...s.breakingBanner.label, en: v } })} />
        </div>
        <Chk label="Maintenance mode (public site shows a notice; staff can still sign in)" checked={s.maintenanceMode} onChange={(v) => set("maintenanceMode", v)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Txt label="Maintenance message (தமிழ்)" value={s.maintenanceMessage?.ta ?? ""} onChange={(v) => set("maintenanceMessage", { ...s.maintenanceMessage, ta: v })} />
          <Txt label="Maintenance message (English)" value={s.maintenanceMessage?.en ?? ""} onChange={(v) => set("maintenanceMessage", { ...s.maintenanceMessage, en: v })} />
        </div>
      </Section>

      <Section title="Reader submissions & uploads">
        <Chk label="Accept article submissions" checked={s.submissions.enabled} onChange={(v) => set("submissions", { ...s.submissions, enabled: v })} />
        <Chk label="Require a verified email to submit or upload" checked={s.submissions.requireVerifiedEmail} onChange={(v) => set("submissions", { ...s.submissions, requireVerifiedEmail: v })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Txt type="number" label="Max photos per submission" value={s.submissions.maxImagesPerArticle} onChange={(v) => set("submissions", { ...s.submissions, maxImagesPerArticle: Number(v) || 0 })} />
          <Txt type="number" label="Minimum words" value={s.submissions.minWords} onChange={(v) => set("submissions", { ...s.submissions, minWords: Number(v) || 0 })} />
          <Txt type="number" label="Max upload size (MB)" value={s.uploads.maxMb} onChange={(v) => set("uploads", { ...s.uploads, maxMb: Number(v) || 1 })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Txt label="Submission rules (தமிழ்)" value={s.submissions.rules?.ta ?? ""} onChange={(v) => set("submissions", { ...s.submissions, rules: { ...s.submissions.rules, ta: v } })} />
          <Txt label="Submission rules (English)" value={s.submissions.rules?.en ?? ""} onChange={(v) => set("submissions", { ...s.submissions, rules: { ...s.submissions.rules, en: v } })} />
        </div>
      </Section>

      <Section title="AI assistant">
        <Chk label="Enable the AI assistant for permitted staff" checked={s.ai.enabled} onChange={(v) => set("ai", { ...s.ai, enabled: v })} />
        <Txt type="number" label="Requests per user per hour" value={s.ai.hourlyLimitPerUser} onChange={(v) => set("ai", { ...s.ai, hourlyLimitPerUser: Number(v) || 1 })} />
      </Section>

      <Section title="Headlines" hint="Type your own headlines for the top of the homepage (they appear under “தலைப்புச் செய்திகள்”, lowest Order first). Link is optional: a page on this site like /ta/news/… or a full https:// address.">
        {(s.customHeadlines ?? []).map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_5rem_auto_auto] items-end gap-2">
            <Txt label="Headline" value={h.text ?? ""} maxLength={300} onChange={(v) => set("customHeadlines", (s.customHeadlines ?? []).map((x, j) => (j === i ? { ...x, text: v } : x)))} />
            <Txt label="Link (optional)" value={h.href ?? ""} onChange={(v) => set("customHeadlines", (s.customHeadlines ?? []).map((x, j) => (j === i ? { ...x, href: v } : x)))} />
            <Txt type="number" label="Order" value={h.order ?? 100} onChange={(v) => set("customHeadlines", (s.customHeadlines ?? []).map((x, j) => (j === i ? { ...x, order: Number(v) || 0 } : x)))} />
            <Chk label="On" checked={h.enabled !== false} onChange={(v) => set("customHeadlines", (s.customHeadlines ?? []).map((x, j) => (j === i ? { ...x, enabled: v } : x)))} />
            <button type="button" className="pb-1 text-xs font-bold text-accent underline" onClick={() => set("customHeadlines", (s.customHeadlines ?? []).filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="text-sm font-bold text-brand" onClick={() => set("customHeadlines", [...(s.customHeadlines ?? []), { text: "", href: "", enabled: true, order: ((s.customHeadlines ?? []).length + 1) * 10 }])}>
          + Add headline
        </button>
        <div className="border-t border-rule pt-3">
          <p className="text-xs font-bold">Priority regions</p>
          <p className="mb-2 text-xs text-ink3">Stories from these categories are shown first in the headlines (admin-featured stories still come before them).</p>
          <div className="grid gap-1 sm:grid-cols-3">
            {categories.map((c) => (
              <Chk key={c.slug} label={c.name} checked={(s.priorityRegions ?? []).includes(c.slug)} onChange={(v) => set("priorityRegions", v ? [...(s.priorityRegions ?? []), c.slug] : (s.priorityRegions ?? []).filter((x) => x !== c.slug))} />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Homepage sections" hint="Leave empty to show every top-level category in navigation order. Otherwise only the rows below are shown, sorted by Order.">
        {s.homepageSections.map((h, i) => (
          <div key={i} className="grid grid-cols-[1fr_5rem_5rem_auto_auto] items-end gap-2">
            <label className="text-xs font-bold">
              Category
              <select className={`${input} mt-1 font-normal`} value={h.key ?? ""} onChange={(e) => set("homepageSections", s.homepageSections.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <Txt type="number" label="Order" value={h.order ?? 100} onChange={(v) => set("homepageSections", s.homepageSections.map((x, j) => (j === i ? { ...x, order: Number(v) || 0 } : x)))} />
            <Txt type="number" label="Stories" value={h.limit ?? 5} onChange={(v) => set("homepageSections", s.homepageSections.map((x, j) => (j === i ? { ...x, limit: Number(v) || 1 } : x)))} />
            <Chk label="On" checked={h.enabled !== false} onChange={(v) => set("homepageSections", s.homepageSections.map((x, j) => (j === i ? { ...x, enabled: v } : x)))} />
            <button type="button" className="pb-1 text-xs font-bold text-accent underline" onClick={() => set("homepageSections", s.homepageSections.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="text-sm font-bold text-brand" onClick={() => set("homepageSections", [...s.homepageSections, { key: "", enabled: true, order: (s.homepageSections.length + 1) * 10, limit: 5 }])}>
          + Add section
        </button>
      </Section>

      <Section title="Footer links" hint="Extra links shown under Company in the footer.">
        {s.footerLinks.map((f, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <Txt label="Label (தமிழ்)" value={f.label?.ta ?? ""} onChange={(v) => set("footerLinks", s.footerLinks.map((x, j) => (j === i ? { ...x, label: { ...x.label, ta: v } } : x)))} />
            <Txt label="Label (English)" value={f.label?.en ?? ""} onChange={(v) => set("footerLinks", s.footerLinks.map((x, j) => (j === i ? { ...x, label: { ...x.label, en: v } } : x)))} />
            <Txt label="URL (https://… or /path)" value={f.href ?? ""} onChange={(v) => set("footerLinks", s.footerLinks.map((x, j) => (j === i ? { ...x, href: v } : x)))} />
            <button type="button" className="pb-1 text-xs font-bold text-accent underline" onClick={() => set("footerLinks", s.footerLinks.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        {s.footerLinks.length < 12 && (
          <button type="button" className="text-sm font-bold text-brand" onClick={() => set("footerLinks", [...s.footerLinks, { label: {}, href: "" }])}>
            + Add link
          </button>
        )}
      </Section>

      <Section title="Policy & info pages" hint="Edit the About, Contact, Privacy and other pages. HTML is sanitised on save. Leave both fields empty to use the built-in default text.">
        <label className="block text-xs font-bold">
          Page
          <select className={`${input} mt-1 font-normal`} value={pageSlug} onChange={(e) => setPageSlug(e.target.value as StaticSlug)}>
            {STATIC_SLUGS.map((p) => (
              <option key={p} value={p}>
                {STATIC_PAGES[p].title.en}
              </option>
            ))}
          </select>
        </label>
        {(["en", "ta"] as const).map((l) => (
          <label key={l} className="block text-xs font-bold">
            Content ({l === "ta" ? "தமிழ்" : "English"}) — HTML: &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, &lt;a&gt;
            <textarea rows={7} className={`${input} mt-1 font-mono font-normal`} value={page[l] ?? ""} onChange={(e) => set("staticPages", { ...s.staticPages, [pageSlug]: { ...page, [l]: e.target.value } })} />
          </label>
        ))}
      </Section>

      <div className="sticky bottom-0 -mx-4 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur">
        <button className="rounded bg-brand px-6 py-2.5 font-bold text-brand-ink disabled:opacity-60" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>

      <AdsManager ads={ads} />
    </div>
  );
}

function AdsManager({ ads }: { ads: AdItem[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [d, setD] = useState({ slot: "home_sidebar", name: "", href: "https://", alt: "", imageMedia: "", locales: ["ta", "en"] as string[] });
  const [up, setUp] = useState<number | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setUp(0);
    const r = await uploadFile(f, setUp);
    setUp(null);
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setD((x) => ({ ...x, imageMedia: r.data.media.id }));
  }
  async function create() {
    setMsg(null);
    const r = await api("/admin/ads", { body: { ...d, enabled: true } });
    if (!r.ok) return setMsg({ kind: "error", text: r.fieldErrors ? `${r.error} (${Object.keys(r.fieldErrors).join(", ")})` : r.error });
    setD({ ...d, name: "", imageMedia: "", alt: "" });
    router.refresh();
  }
  return (
    <Section title="Advertisements" hint="Image ads only (no raw HTML), shown in the chosen placement. The image becomes public when the ad is saved.">
      {msg && <FormAlert kind={msg.kind}>{msg.text}</FormAlert>}
      <ul className="divide-y divide-rule text-sm">
        {ads.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${a.imageMedia}/thumb`} alt="" className="h-12 w-20 rounded object-cover" />
            <span className="min-w-0 flex-1">
              <strong>{a.name}</strong> <span className="text-xs text-ink3">· {a.slot} · {a.locales.join("/")}</span>
              <span className="block truncate text-xs text-ink3">{a.href}</span>
            </span>
            <button
              type="button"
              className="text-xs font-bold text-brand underline"
              onClick={async () => {
                await api(`/admin/ads/${a.id}`, { method: "PUT", body: { slot: a.slot, name: a.name, imageMedia: a.imageMedia, href: a.href, alt: a.alt, locales: a.locales, enabled: !a.enabled } });
                router.refresh();
              }}
            >
              {a.enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              className="text-xs font-bold text-accent underline"
              onClick={async () => {
                if (!window.confirm("Delete this ad?")) return;
                await api(`/admin/ads/${a.id}`, { method: "DELETE" });
                router.refresh();
              }}
            >
              Delete
            </button>
          </li>
        ))}
        {ads.length === 0 && <li className="py-2 text-ink3">No ads yet.</li>}
      </ul>
      <div className="grid gap-3 border-t border-rule pt-3 sm:grid-cols-2">
        <label className="block text-xs font-bold">
          Placement
          <select className={`${input} mt-1 font-normal`} value={d.slot} onChange={(e) => setD({ ...d, slot: e.target.value })}>
            {SLOTS.map((x) => (
              <option key={x} value={x}>
                {x.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <Txt label="Name" value={d.name} onChange={(v) => setD({ ...d, name: v })} />
        <Txt label="Link (https://…)" value={d.href} onChange={(v) => setD({ ...d, href: v })} />
        <Txt label="Alt text" value={d.alt} onChange={(v) => setD({ ...d, alt: v })} />
        <div>
          <label className="inline-block cursor-pointer rounded border border-brand px-3 py-1.5 text-sm font-bold text-brand">
            {up !== null ? `Uploading ${up}%` : d.imageMedia ? "Image ready ✓ (replace)" : "Upload ad image"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {(["ta", "en"] as const).map((l) => (
            <Chk key={l} label={l === "ta" ? "தமிழ்" : "English"} checked={d.locales.includes(l)} onChange={(v) => setD({ ...d, locales: v ? [...d.locales, l] : d.locales.filter((x) => x !== l) })} />
          ))}
        </div>
      </div>
      <button type="button" className="rounded bg-brand px-4 py-2 text-sm font-bold text-brand-ink disabled:opacity-60" disabled={!d.imageMedia || !d.name} onClick={create}>
        Add advertisement
      </button>
    </Section>
  );
}
