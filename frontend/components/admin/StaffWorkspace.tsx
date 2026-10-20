"use client";
import { useState } from "react";
import type { CategoryNode, EditArticle } from "@/lib/types";
import { ArticleEditor, type EditorHooks } from "@/components/editor/ArticleEditor";
import { AiPanel } from "./AiPanel";
import { WorkflowPanel } from "./WorkflowPanel";

type Editor = { id: string; name: string; role: string };

/** Editor on the left; workflow, assignment, notes, history and the AI assistant on the right. */
export function StaffWorkspace({ article, tree, allowed, editors, maxImages }: { article: EditArticle | null; tree: CategoryNode[]; allowed: string[]; editors: Editor[]; maxImages: number }) {
  const [hooks, setHooks] = useState<EditorHooks | null>(null);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 rounded border border-rule bg-paper p-4">
        <ArticleEditor lang="en" initial={article} tree={tree} maxImages={maxImages} minWords={0} staff onHooks={setHooks} afterSubmitHref="/admin/articles/{id}" basePath="/admin/articles/{id}" />
      </div>
      <div className="space-y-5">
        {article && <WorkflowPanel article={article} allowed={allowed} editors={editors} />}
        {(!article || article.can.ai) && <AiPanel articleId={article?.id} hooks={hooks} />}
        {article && (article.previewUrls.ta || article.previewUrls.en) && (
          <section className="rounded border border-rule bg-paper p-4 text-sm">
            <h2 className="headline text-lg">Public URLs</h2>
            <p className="text-xs text-ink3">Only reachable once the article is published (or its scheduled time has passed).</p>
            <ul className="mt-1 space-y-1">
              {article.previewUrls.ta && (
                <li>
                  <a className="text-brand underline" href={article.previewUrls.ta} target="_blank" rel="noopener">
                    Tamil: {decodeURIComponent(article.previewUrls.ta)}
                  </a>
                </li>
              )}
              {article.previewUrls.en && (
                <li>
                  <a className="text-brand underline" href={article.previewUrls.en.replace("/ta/", "/en/")} target="_blank" rel="noopener">
                    English: {article.previewUrls.en}
                  </a>
                </li>
              )}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
