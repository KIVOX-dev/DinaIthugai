export const PERMISSIONS = [
  "articles.create",
  "articles.edit",
  "articles.review",
  "articles.approve",
  "articles.publish",
  "articles.schedule",
  "articles.unpublish",
  "articles.delete",
  "articles.feature",
  "users.view",
  "users.edit",
  "users.suspend",
  "users.manage_roles",
  "users.export",
  "users.delete",
  "media.manage",
  "categories.manage",
  "ai.rewrite",
  "settings.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["reader", "contributor", "reporter", "editor", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles that may open /admin at all. */
export const STAFF_ROLES: Role[] = ["reporter", "editor", "admin", "super_admin"];

const editorBase: Permission[] = [
  "articles.create",
  "articles.edit",
  "articles.review",
  "articles.approve",
  "articles.unpublish",
  "articles.feature",
  "media.manage",
  "categories.manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  reader: [],
  contributor: [],
  reporter: ["articles.create"],
  // Editors may NOT publish unless the permission is explicitly granted on the user.
  editor: editorBase,
  admin: [
    ...editorBase,
    "articles.publish",
    "articles.schedule",
    "articles.delete",
    "users.view",
    "users.edit",
    "users.suspend",
    "users.export",
    "ai.rewrite",
    "settings.manage",
    "audit.view",
  ],
  super_admin: [...PERMISSIONS],
};

/** Rank used to stop a user from managing someone at or above their own level. */
export const ROLE_RANK: Record<Role, number> = {
  reader: 0,
  contributor: 1,
  reporter: 2,
  editor: 3,
  admin: 4,
  super_admin: 5,
};

export type PrincipalLike = { role: Role; permissions?: string[] };

export function effectivePermissions(p: PrincipalLike): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[p.role] ?? []);
  for (const x of p.permissions ?? []) if ((PERMISSIONS as readonly string[]).includes(x)) set.add(x as Permission);
  return set;
}

export function can(p: PrincipalLike | null | undefined, perm: Permission): boolean {
  if (!p) return false;
  if (p.role === "super_admin") return true;
  return effectivePermissions(p).has(perm);
}

export const isStaff = (p: PrincipalLike | null | undefined) => !!p && STAFF_ROLES.includes(p.role);
