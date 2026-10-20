"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";

export function LogoutButton({ lang, label }: { lang: string; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="hover:underline"
      onClick={async () => {
        await api("/auth/logout", { method: "POST" });
        router.push(`/${lang}`);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
