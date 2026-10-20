const SOCIAL: Record<string, { label: string; bg: string; path: string }> = {
  facebook: { label: "Facebook", bg: "#1877f2", path: "M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z" },
  x: { label: "X", bg: "#000000", path: "M17.8 4h2.7l-5.9 6.7L21.5 20h-5.4l-4.2-5.5L7 20H4.3l6.3-7.2L3.8 4h5.5l3.8 5zm-1 14.4h1.5L8.6 5.5H7z" },
  instagram: { label: "Instagram", bg: "#e1306c", path: "M12 7.5A4.5 4.5 0 1 0 12 16.5 4.5 4.5 0 0 0 12 7.5zm0 7.4a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8zM17.2 6.3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3zm0 1.6A2.9 2.9 0 0 0 4.6 7.5v9a2.9 2.9 0 0 0 2.9 2.9h9a2.9 2.9 0 0 0 2.9-2.9v-9a2.9 2.9 0 0 0-2.9-2.9z" },
  youtube: { label: "YouTube", bg: "#ff0000", path: "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" },
  whatsapp: { label: "WhatsApp", bg: "#25d366", path: "M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zm4.6 12.3c-.2.6-1.1 1.1-1.6 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.7c.1.1.1.3 0 .4l-.3.4-.3.3c-.1.1-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.7 1 1.9 1.1.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.1.1.6-.1 1.2z" },
};

/** Round brand-coloured social icons. Only networks configured in admin settings are shown (no dead links). */
export function SocialIcons({ social, size = 32 }: { social?: Record<string, string | null | undefined>; size?: number }) {
  const items = Object.entries(SOCIAL).filter(([k]) => social?.[k]);
  if (!items.length) return null;
  return (
    <ul className="flex items-center gap-2">
      {items.map(([k, s]) => (
        <li key={k}>
          <a href={String(social?.[k])} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="flex items-center justify-center rounded-full" style={{ background: s.bg, width: size, height: size }}>
            <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
              <path d={s.path} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
