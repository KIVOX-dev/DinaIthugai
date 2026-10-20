export function AuthShell({ title, sub, children, wide = false }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto px-4 py-10 ${wide ? "max-w-3xl" : "max-w-md"}`}>
      <h1 className="headline text-3xl">{title}</h1>
      {sub && <p className="mt-1 mb-6 text-ink2">{sub}</p>}
      <div className={sub ? "" : "mt-6"}>{children}</div>
    </div>
  );
}
