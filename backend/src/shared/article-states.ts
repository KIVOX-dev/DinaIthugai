import { can, type PrincipalLike, type Permission } from "../shared/permissions";

export const STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
  "scheduled",
  "published",
  "unpublished",
  "archived",
] as const;
export type ArticleStatus = (typeof STATUSES)[number];
export type ArticleSource = "staff" | "community";

/** Documented state machine: from -> allowed targets. */
export const TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  draft: ["submitted", "approved", "scheduled", "published", "archived"],
  submitted: ["in_review", "approved", "rejected", "changes_requested"],
  in_review: ["approved", "rejected", "changes_requested"],
  changes_requested: ["submitted", "archived"],
  approved: ["published", "scheduled", "in_review"],
  rejected: ["in_review", "archived"],
  scheduled: ["published", "approved"],
  published: ["unpublished", "archived"],
  unpublished: ["published", "archived", "draft"],
  archived: ["draft"],
};

/** Statuses during which the author may not edit (content is locked for review). */
export const AUTHOR_LOCKED: ArticleStatus[] = ["submitted", "in_review", "approved", "scheduled", "published", "rejected", "archived", "unpublished"];
/** Statuses in which the author may edit the draft. */
export const AUTHOR_EDITABLE: ArticleStatus[] = ["draft", "changes_requested"];

export const REASON_REQUIRED: ArticleStatus[] = ["rejected", "changes_requested"];

export const IN_REVIEW_QUEUE: ArticleStatus[] = ["submitted", "in_review", "changes_requested"];

export type TransitionCtx = {
  from: ArticleStatus;
  to: ArticleStatus;
  source: ArticleSource;
  actor: PrincipalLike | null;
  isOwner: boolean;
  /** `true` when invoked by the scheduler, which is a trusted system actor. */
  system?: boolean;
};

export type TransitionResult = { ok: true } | { ok: false; code: "invalid_transition" | "forbidden" | "community_needs_approval"; message: string };

function needs(to: ArticleStatus, from: ArticleStatus): Permission | "owner" {
  switch (to) {
    case "submitted":
      return "owner";
    case "in_review":
      return "articles.review";
    case "approved":
      return from === "scheduled" ? "articles.schedule" : "articles.approve";
    case "rejected":
    case "changes_requested":
      return "articles.review";
    case "published":
      return "articles.publish";
    case "scheduled":
      return "articles.schedule";
    case "unpublished":
    case "archived":
      return from === "draft" || from === "changes_requested" || from === "rejected" ? "owner" : "articles.unpublish";
    case "draft":
      return from === "archived" || from === "unpublished" ? "articles.unpublish" : "owner";
  }
}

export function checkTransition(ctx: TransitionCtx): TransitionResult {
  const { from, to, source, actor, isOwner, system } = ctx;
  if (!TRANSITIONS[from]?.includes(to)) {
    return { ok: false, code: "invalid_transition", message: `Cannot move an article from "${from}" to "${to}".` };
  }
  // Community submissions can never skip moderation.
  if (source === "community" && (to === "published" || to === "scheduled") && from === "draft") {
    return { ok: false, code: "community_needs_approval", message: "Community submissions must be reviewed and approved first." };
  }
  if (source === "community" && to === "approved" && from === "draft") {
    return { ok: false, code: "community_needs_approval", message: "Community submissions must be reviewed first." };
  }
  if (system && from === "scheduled" && to === "published") return { ok: true };

  const need = needs(to, from);
  if (need === "owner") {
    // Owners may submit/withdraw their own work; staff with edit rights can do it on behalf.
    if ((isOwner && actor) || can(actor, "articles.edit")) return { ok: true };
    return { ok: false, code: "forbidden", message: "You are not allowed to perform this action." };
  }
  if (!can(actor, need)) return { ok: false, code: "forbidden", message: `Missing permission: ${need}` };
  return { ok: true };
}

export const STATUS_LABELS: Record<ArticleStatus, { en: string; ta: string }> = {
  draft: { en: "Draft", ta: "வரைவு" },
  submitted: { en: "Submitted", ta: "சமர்ப்பிக்கப்பட்டது" },
  in_review: { en: "Under review", ta: "பரிசீலனையில்" },
  changes_requested: { en: "Changes requested", ta: "திருத்தம் தேவை" },
  approved: { en: "Approved", ta: "ஒப்புதல்" },
  rejected: { en: "Rejected", ta: "நிராகரிக்கப்பட்டது" },
  scheduled: { en: "Scheduled", ta: "திட்டமிடப்பட்டது" },
  published: { en: "Published", ta: "வெளியிடப்பட்டது" },
  unpublished: { en: "Unpublished", ta: "வெளியீடு நிறுத்தம்" },
  archived: { en: "Archived", ta: "காப்பகம்" },
};
