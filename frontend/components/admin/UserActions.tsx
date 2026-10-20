"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { FormAlert } from "@/components/forms/Field";
import { PERMISSIONS, ROLES } from "@/lib/shared/permissions";

type U = {
  id: string;
  name: string;
  role: string;
  status: string;
  permissions: string[];
  publicAuthor: boolean;
  emailVerified: boolean;
  deletionRequestedAt?: string;
  address?: { line1: string; line2?: string; city: string; district?: string; state: string; postalCode: string; country: string };
  phone: string;
  gender: string;
  bio?: string;
};
const btn = "rounded border px-3 py-1.5 text-sm font-bold disabled:opacity-50";
const input = "w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm";

export function UserActions({ user, meId, meRole, canManageRoles, canSuspend, canEdit, canDelete }: { user: U; meId: string; meRole: string; canManageRoles: boolean; canSuspend: boolean; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [reason, setReason] = useState("");
  const [role, setRole] = useState(user.role);
  const [perms, setPerms] = useState<string[]>(user.permissions);
  const [pw, setPw] = useState("");
  const [note, setNote] = useState("");
  const self = user.id === meId;

  async function call(path: string, body: unknown, ok: string, confirm?: string) {
    if (confirm && !window.confirm(confirm)) return;
    setMsg(null);
    const r = await api(`/admin/users/${user.id}${path}`, { body });
    if (!r.ok) return setMsg({ kind: "error", text: r.error });
    setMsg({ kind: "ok", text: ok });
    router.refresh();
  }

  const privileged = ["admin", "super_admin"].includes(role) || ["admin", "super_admin"].includes(user.role);
  return (
    <div className="space-y-5">
      {msg && <FormAlert kind={msg.kind}>{msg.text}</FormAlert>}

      {canSuspend && !self && (
        <section className="rounded border border-rule bg-paper p-4">
          <h2 className="headline text-lg">Account status</h2>
          <label className="mt-2 block text-sm font-bold">
            Reason (required to suspend or disable)
            <input className={`${input} mt-1 font-normal`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {user.status !== "active" && (
              <button className={`${btn} border-ok text-ok`} onClick={() => call("/status", { status: "active" }, "Account reactivated")}>
                Reactivate
              </button>
            )}
            {user.status !== "suspended" && (
              <button className={`${btn} border-warn text-warn`} onClick={() => call("/status", { status: "suspended", reason, confirm: true }, "Account suspended", "Suspend this account? They will be signed out.")}>
                Suspend
              </button>
            )}
            {user.status !== "disabled" && (
              <button className={`${btn} border-accent text-accent`} onClick={() => call("/status", { status: "disabled", reason, confirm: true }, "Account disabled", "Disable this account (e.g. compromised)? They will be signed out.")}>
                Disable
              </button>
            )}
          </div>
        </section>
      )}

      {canEdit && (
        <section className="rounded border border-rule bg-paper p-4">
          <h2 className="headline text-lg">Security</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={`${btn} border-brand text-brand`} onClick={() => call("/revoke-sessions", {}, "All sessions revoked", "Sign this user out everywhere?")}>
              Revoke sessions
            </button>
            {!self && (
              <button className={`${btn} border-brand text-brand`} onClick={() => call("/reset-password", {}, "Password-reset email sent", "Send a password-reset email to this user?")}>
                Send password reset
              </button>
            )}
            {!user.emailVerified && (
              <button className={`${btn} border-brand text-brand`} onClick={() => call("/verify-email", {}, "Email marked verified", "Mark this email address as verified?")}>
                Mark email verified
              </button>
            )}
            <button className={`${btn} border-rule`} onClick={() => call("/public-author", { on: !user.publicAuthor }, user.publicAuthor ? "Author page hidden" : "Public author page enabled")}>
              {user.publicAuthor ? "Hide author page" : "Show public author page"}
            </button>
          </div>
        </section>
      )}

      {canManageRoles && !self && (
        <section className="rounded border border-rule bg-paper p-4">
          <h2 className="headline text-lg">Role &amp; permissions</h2>
          <label className="mt-2 block text-sm font-bold">
            Role
            <select className={`${input} mt-1 font-normal`} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.filter((r) => meRole === "super_admin" || r !== "super_admin").map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="mt-3">
            <legend className="text-sm font-bold">Additional permissions (on top of the role)</legend>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" className="h-4 w-4" checked={perms.includes(p)} onChange={(e) => setPerms(e.target.checked ? [...perms, p] : perms.filter((x) => x !== p))} /> {p}
                </label>
              ))}
            </div>
          </fieldset>
          {privileged && (
            <label className="mt-3 block text-sm font-bold">
              Confirm with your password (critical change)
              <input type="password" autoComplete="current-password" className={`${input} mt-1 font-normal`} value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
          )}
          <button className={`${btn} mt-3 border-brand bg-brand text-brand-ink`} onClick={() => call("/role", { role, permissions: perms, confirm: true, reauthPassword: pw || undefined }, "Role updated; the user was signed out", "Change this user's role and permissions? They will be signed out.")}>
            Save role
          </button>
        </section>
      )}

      {canEdit && (
        <section className="rounded border border-rule bg-paper p-4">
          <h2 className="headline text-lg">Internal note</h2>
          <textarea className={`${input} mt-2`} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Internal note" />
          <button
            className={`${btn} mt-2 border-brand text-brand`}
            onClick={async () => {
              if (!note.trim()) return;
              await call("/notes", { note }, "Note added");
              setNote("");
            }}
          >
            Add note
          </button>
        </section>
      )}

      {canDelete && !self && user.status !== "deleted" && user.role !== "super_admin" && (
        <section className="rounded border border-accent/50 bg-paper p-4">
          <h2 className="headline text-lg text-accent">Delete account</h2>
          <p className="text-sm text-ink2">{user.deletionRequestedAt ? "The user requested deletion." : "No deletion request on file; only a super administrator can proceed."} Personal data is anonymised; published articles stay online without their details.</p>
          <button className={`${btn} mt-2 border-accent text-accent`} onClick={() => call("/delete", { confirm: true }, "Account anonymised and removed", "Permanently anonymise this account? This cannot be undone.")}>
            Process deletion
          </button>
        </section>
      )}
    </div>
  );
}
