"use client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";
import { uploadFile } from "@/lib/client-api";
import { msg } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/shared/i18n";

export type EditorHandle = { setHtml: (html: string) => void; getHtml: () => string };

type Props = {
  lang: Locale; // UI language
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onUploaded?: (m: { id: string; url: string }) => void;
  labels: { insertImage: string; uploading: string; bold: string; italic: string; h2: string; h3: string; bullets: string; numbers: string; quote: string; link: string; undo: string; redo: string };
  handleRef?: React.MutableRefObject<EditorHandle | null>;
  id?: string;
  language?: string; // content language, for lang attribute / spellcheck
};

function Btn({ on, active, label, children, disabled }: { on: () => void; active?: boolean; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={on}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`flex h-9 min-w-9 items-center justify-center rounded px-2 text-sm font-bold disabled:opacity-40 ${active ? "bg-brand text-brand-ink" : "hover:bg-paper2"}`}
    >
      {children}
    </button>
  );
}

/** Rich-text editor (TipTap). Images are uploaded to the backend and referenced by /api/media/:id/lg, which the server sanitiser allows. */
export function RichEditor({ lang, value, onChange, placeholder, disabled, onUploaded, labels, handleRef, id, language }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Editor updates that were not caused by the user (initial load / normalisation) must not count as edits.
  const programmatic = useRef(false);
  const editor = useEditor({
    immediatelyRender: false, // avoids SSR hydration mismatch
    editable: !disabled,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow" } } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    editorProps: { attributes: { id: id ?? "editor", lang: language ?? "", class: "prose-news max-w-none", spellcheck: "true" } },
    onUpdate: ({ editor: e, transaction }) => {
      if (!transaction.docChanged) return;
      if (!e.isFocused && !programmatic.current) return; // not typed by the user
      onChange(e.isEmpty ? "" : e.getHTML());
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      setHtml: (html) => {
        programmatic.current = true; // an accepted AI/restore change IS a real edit
        editor?.commands.setContent(html, { emitUpdate: true });
        programmatic.current = false;
      },
      getHtml: () => (editor && !editor.isEmpty ? editor.getHTML() : ""),
    };
    return () => {
      handleRef.current = null;
    };
  }, [editor, handleRef]);

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file || !editor) return;
    setErr(null);
    setProgress(0);
    const r = await uploadFile(file, setProgress);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    if (!r.ok) return setErr(msg(lang, r.fieldErrors?.file) !== msg(lang, undefined) && r.fieldErrors?.file ? msg(lang, r.fieldErrors.file) : r.error);
    const m = r.data.media;
    editor.chain().focus().setImage({ src: `/api/media/${m.id}/lg`, alt: m.caption.en || m.caption.ta || "" }).run();
    onUploaded?.({ id: m.id, url: m.url });
  }

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("https://", prev ?? "https://");
    if (url === null) return;
    if (url === "") return void editor.chain().focus().extendMarkRange("link").unsetLink().run();
    if (!/^https?:\/\//i.test(url)) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="rounded border border-rule bg-paper focus-within:border-brand">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-rule p-1">
        <Btn label={labels.bold} on={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} disabled={disabled}>
          B
        </Btn>
        <Btn label={labels.italic} on={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} disabled={disabled}>
          <em>I</em>
        </Btn>
        <Btn label={labels.h2} on={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} disabled={disabled}>
          H2
        </Btn>
        <Btn label={labels.h3} on={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive("heading", { level: 3 })} disabled={disabled}>
          H3
        </Btn>
        <Btn label={labels.bullets} on={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} disabled={disabled}>
          • —
        </Btn>
        <Btn label={labels.numbers} on={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")} disabled={disabled}>
          1.
        </Btn>
        <Btn label={labels.quote} on={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive("blockquote")} disabled={disabled}>
          ❝
        </Btn>
        <Btn label={labels.link} on={setLink} active={editor?.isActive("link")} disabled={disabled}>
          🔗
        </Btn>
        <span className="mx-1 h-6 w-px bg-rule" aria-hidden="true" />
        <Btn label={labels.insertImage} on={() => fileRef.current?.click()} disabled={disabled || progress !== null}>
          🖼 <span className="ml-1 hidden sm:inline">{labels.insertImage}</span>
        </Btn>
        <Btn label={labels.undo} on={() => editor?.chain().focus().undo().run()} disabled={disabled || !editor?.can().undo()}>
          ↶
        </Btn>
        <Btn label={labels.redo} on={() => editor?.chain().focus().redo().run()} disabled={disabled || !editor?.can().redo()}>
          ↷
        </Btn>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files)} aria-hidden="true" />
        {progress !== null && (
          <span className="ml-2 text-sm text-ink2" role="status">
            {labels.uploading} {progress}%
          </span>
        )}
      </div>
      {err && (
        <p role="alert" className="border-b border-rule bg-accent/10 px-3 py-1.5 text-sm text-accent">
          {err}
        </p>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
