"use client";
import { useEffect, useState } from "react";

export function ShareButtons({ title, url, labels }: { title: string; url: string; labels: { share: string; copy: string; copied: string } }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const links = [
    ["WhatsApp", `https://wa.me/?text=${enc(title + " " + url)}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ["X", `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`],
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-bold">{labels.share}:</span>
      {links.map(([n, h]) => (
          <a key={n} href={h} target="_blank" rel="noopener noreferrer" className="rounded border border-rule px-2.5 py-1 no-underline hover:bg-paper2">
            {n}
          </a>
        ))}
      <button
        type="button"
        className="rounded border border-rule px-2.5 py-1 hover:bg-paper2"
        onClick={async () => {
          await navigator.clipboard?.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? labels.copied : labels.copy}
      </button>
    </div>
  );
}

/** Counts a view once per browser session per article (real data behind "most read"). */
export function ViewCounter({ id }: { id: string }) {
  useEffect(() => {
    try {
      const k = `v:${id}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {}
    fetch(`/api/public/articles/${id}/view`, { method: "POST" }).catch(() => {});
  }, [id]);
  return null;
}
