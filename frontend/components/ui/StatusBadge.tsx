import type { Locale } from "@/lib/shared/i18n";
import { STATUS_LABELS, type ArticleStatus } from "@/lib/shared/article-states";

const tone: Record<string, string> = {
  draft: "bg-paper2 text-ink2 border-rule",
  submitted: "bg-brand/10 text-brand border-brand/40",
  in_review: "bg-brand/10 text-brand border-brand/40",
  changes_requested: "bg-warn/10 text-warn border-warn/50",
  approved: "bg-ok/10 text-ok border-ok/40",
  scheduled: "bg-brand/10 text-brand border-brand/40",
  published: "bg-ok/10 text-ok border-ok/40",
  rejected: "bg-accent/10 text-accent border-accent/40",
  unpublished: "bg-paper2 text-ink2 border-rule",
  archived: "bg-paper2 text-ink3 border-rule",
};

export function StatusBadge({ status, lang }: { status: string; lang: Locale }) {
  const label = STATUS_LABELS[status as ArticleStatus]?.[lang] ?? status;
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${tone[status] ?? tone.draft}`}>{label}</span>;
}
