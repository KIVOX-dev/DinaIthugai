import Link from "next/link";

// Bilingual because not-found.tsx has no access to the [lang] param.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="headline text-6xl text-brand">404</p>
      <h1 className="headline mt-3 text-2xl">பக்கம் கிடைக்கவில்லை · Page not found</h1>
      <p className="mt-2 text-ink2">நீங்கள் தேடும் பக்கம் இல்லை அல்லது நீக்கப்பட்டுவிட்டது. The page you are looking for does not exist or is no longer available.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/ta" className="rounded bg-brand px-4 py-2 font-bold text-brand-ink no-underline">
          முகப்பு
        </Link>
        <Link href="/en" className="rounded border border-brand px-4 py-2 font-bold text-brand no-underline">
          Home
        </Link>
      </div>
    </div>
  );
}
