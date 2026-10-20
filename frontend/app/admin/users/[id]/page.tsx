import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, apiGet } from "@/lib/api";
import { fmt, requireStaffPage } from "@/lib/admin";
import { can } from "@/lib/shared/permissions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserActions } from "@/components/admin/UserActions";

export const metadata: Metadata = { title: "User" };

type Detail = {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    emailVerified: boolean;
    createdAt: string;
    lastLoginAt?: string;
    gender: string;
    address?: { line1: string; line2?: string; city: string; district?: string; state: string; postalCode: string; country: string };
    permissions: string[];
    effectivePermissions: string[];
    statusReason?: string;
    bio?: string;
    publicAuthor: boolean;
    deletionRequestedAt?: string;
    consentAt?: string;
    notes: { by: string; note: string; at: string }[];
  };
  submissions: { id: string; title: string; status: string; createdAt: string }[];
  sessions: { id: string; createdAt: string; ip?: string; userAgent?: string }[];
  activity: { action: string; at: string }[];
};

export default async function UserDetail({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const me = await requireStaffPage(`/admin/users/${id}`, "users.view");
  let d: Detail;
  try {
    d = await apiGet<Detail>(`/admin/users/${id}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  const u = d.user;
  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[9rem_1fr] gap-2 border-b border-rule py-1.5 text-sm last:border-0">
      <dt className="text-ink3">{k}</dt>
      <dd className="min-w-0 break-words">{v || "—"}</dd>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link href="/admin/users" className="text-brand">
          ← Users
        </Link>
      </p>
      <h1 className="headline text-3xl">{u.name}</h1>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-5">
          <section className="rounded border border-rule bg-paper p-4">
            <h2 className="headline mb-2 text-lg">Profile (restricted: visible to authorised staff only)</h2>
            <dl>
              {row("Email", `${u.email} ${u.emailVerified ? "✓ verified" : "(unverified)"}`)}
              {row("Phone", u.phone)}
              {row("Gender", u.gender.replaceAll("_", " "))}
              {row("Address", u.address && [u.address.line1, u.address.line2, u.address.city, u.address.district, u.address.state, u.address.postalCode, u.address.country].filter(Boolean).join(", "))}
              {row("Role", <span className="capitalize">{u.role.replace("_", " ")}</span>)}
              {row("Status", <span className="font-bold capitalize">{u.status.replace("_", " ")}{u.statusReason ? ` — ${u.statusReason}` : ""}</span>)}
              {row("Registered", fmt(u.createdAt))}
              {row("Last login", fmt(u.lastLoginAt))}
              {row("Consent given", fmt(u.consentAt))}
              {row("Effective permissions", <span className="text-xs">{u.effectivePermissions.join(", ") || "none"}</span>)}
            </dl>
          </section>

          <section className="rounded border border-rule bg-paper p-4">
            <h2 className="headline mb-2 text-lg">Submissions ({d.submissions.length})</h2>
            {d.submissions.length === 0 ? (
              <p className="text-sm text-ink3">None.</p>
            ) : (
              <ul className="divide-y divide-rule text-sm">
                {d.submissions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                    <Link href={`/admin/articles/${s.id}`} className="truncate">
                      {s.title}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={s.status} lang="en" />
                      <span className="text-xs text-ink3">{fmt(s.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded border border-rule bg-paper p-4">
            <h2 className="headline mb-2 text-lg">Active sessions ({d.sessions.length})</h2>
            <ul className="space-y-1 text-xs text-ink2">
              {d.sessions.map((s) => (
                <li key={s.id}>
                  {fmt(s.createdAt)} · {s.ip ?? "?"} · <span className="break-all">{s.userAgent?.slice(0, 80)}</span>
                </li>
              ))}
              {d.sessions.length === 0 && <li>None.</li>}
            </ul>
          </section>

          <section className="rounded border border-rule bg-paper p-4">
            <h2 className="headline mb-2 text-lg">Internal notes</h2>
            {u.notes.length === 0 ? <p className="text-sm text-ink3">None.</p> : u.notes.map((n, i) => <p key={i} className="mb-1 rounded bg-paper2 p-2 text-sm">{n.note} <span className="text-xs text-ink3">· {fmt(n.at)}</span></p>)}
          </section>

          <section className="rounded border border-rule bg-paper p-4">
            <h2 className="headline mb-2 text-lg">Recent activity</h2>
            <ul className="space-y-0.5 text-xs text-ink2">
              {d.activity.map((a, i) => (
                <li key={i}>
                  {fmt(a.at)} · {a.action}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <UserActions
          user={{ id: u.id, name: u.name, role: u.role, status: u.status, permissions: u.permissions, publicAuthor: u.publicAuthor, emailVerified: u.emailVerified, deletionRequestedAt: u.deletionRequestedAt, phone: u.phone, gender: u.gender, address: u.address, bio: u.bio }}
          meId={me.id}
          meRole={me.role}
          canManageRoles={can(me, "users.manage_roles")}
          canSuspend={can(me, "users.suspend")}
          canEdit={can(me, "users.edit")}
          canDelete={can(me, "users.delete")}
        />
      </div>
    </div>
  );
}
