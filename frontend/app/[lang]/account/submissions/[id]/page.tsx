import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/shared/i18n";
import { ApiError, apiGet, requireUserPage } from "@/lib/api";
import type { EditArticle } from "@/lib/types";
import { formatDate, makeT } from "@/lib/i18n/dictionary";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FormAlert } from "@/components/forms/Field";
import { DeleteDraft } from "@/components/account/AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Submission", robots: { index: false } };

export default async function SubmissionDetail({ params, searchParams }: PageProps<"/[lang]/account/submissions/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  await requireUserPage(lang, `/${lang}/account/submissions/${id}`);
  const sp = (await searchParams) as { submitted?: string };
  let a: EditArticle;
  try {
    a = (await apiGet<{ article: EditArticle }>(`/articles/${id}`)).article;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const t = makeT(lang);
  const showLang = a.availability[lang] ? lang : a.preferredLanguage;
  const publicHref = a.previewUrls[showLang] ?? a.previewUrls[lang === "ta" ? "en" : "ta"];
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm">
        <Link href={`/${lang}/account/submissions`} className="text-brand">
          ← {t("subs.title")}
        </Link>
      </p>
      {sp.submitted && (
        <div className="mt-3">
          <FormAlert kind="ok">{t("submit.submitted")}</FormAlert>
        </div>
      )}
      <header className="mt-3 flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-3">
        <h1 className="headline text-2xl sm:text-3xl">{a.title[showLang] || "—"}</h1>
        <StatusBadge status={a.status} lang={lang} />
      </header>

      {a.reviewNote && ["changes_requested", "rejected"].includes(a.status) && (
        <section className="mt-4 rounded border border-warn bg-paper2 p-4">
          <h2 className="font-bold">{t("subs.feedback")}</h2>
          <p className="mt-1 whitespace-pre-wrap">{a.reviewNote}</p>
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {a.can.edit && (
          <Link href={`/${lang}/account/submissions/${a.id}/edit`} className="rounded bg-brand px-4 py-2 font-bold text-brand-ink no-underline">
            {t("subs.edit")}
          </Link>
        )}
        {!a.can.edit && a.status !== "published" && <span className="text-sm text-ink2">{t("subs.locked")}</span>}
        {a.status === "published" && publicHref && (
          <Link href={publicHref} className="rounded border border-ok px-4 py-2 font-bold text-ok no-underline">
            {t("subs.view_public")} →
          </Link>
        )}
        {["draft", "changes_requested"].includes(a.status) && <DeleteDraft lang={lang} id={a.id} />}
      </div>

      {a.featuredImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/media/${a.featuredImage}/lg`} alt="" className="mt-5 w-full bg-paper2 object-cover" style={{ aspectRatio: "16/9" }} />
      )}
      <div className="prose-news mt-5" lang={showLang} dangerouslySetInnerHTML={{ __html: a.body[showLang] }} />

      <section className="mt-8 border-t border-rule pt-4">
        <h2 className="font-bold">{t("subs.history")}</h2>
        {a.history.length === 0 ? (
          <p className="text-sm text-ink3">—</p>
        ) : (
          <ol className="mt-2 space-y-2 text-sm">
            {a.history.map((h) => (
              <li key={h.id} className="rounded border border-rule p-2">
                <span className="font-bold capitalize">{h.action.replaceAll("_", " ")}</span> <span className="text-ink3">· {formatDate(h.at, lang, true)}</span>
                {h.reason && <p className="mt-1 whitespace-pre-wrap text-ink2">{h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
