"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" role="alert">
      <h1 className="headline text-2xl">ஏதோ தவறு நேர்ந்தது · Something went wrong</h1>
      <p className="mt-2 text-ink2">எதிர்பாராத பிழை ஏற்பட்டது. மீண்டும் முயலவும். An unexpected error occurred. Please try again.</p>
      <button onClick={reset} className="mt-6 rounded bg-brand px-4 py-2 font-bold text-brand-ink">
        மீண்டும் முயல்க · Try again
      </button>
    </div>
  );
}
