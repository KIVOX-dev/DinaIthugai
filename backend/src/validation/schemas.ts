import { z } from "zod";

/** Messages are i18n keys (`v.*`) resolved by the UI, so validation feedback is bilingual. */
const req = "v.required";

const str = (max = 200) => z.string({ error: req }).trim().min(1, req).max(max, "v.too_long");
const optStr = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, "v.too_long")
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailSchema = z.string({ error: req }).trim().toLowerCase().min(1, req).max(254, "v.too_long").pipe(z.email("v.email"));

export const passwordSchema = z
  .string({ error: req })
  .min(10, "v.password_short")
  .max(128, "v.too_long")
  .refine((p) => /[A-Za-z஀-௿]/.test(p) && /\d/.test(p), "v.password_weak");

/** Country-code + national number -> E.164. */
export const phoneSchema = z
  .object({ countryCode: z.string().regex(/^\+[1-9]\d{0,3}$/, "v.phone"), number: z.string().trim().regex(/^[\d\s\-()]{6,16}$/, "v.phone") })
  .transform((p) => `${p.countryCode}${p.number.replace(/\D/g, "")}`)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "v.phone"));

export const addressSchema = z.object({
  line1: str(200),
  line2: optStr(200),
  city: str(100),
  district: optStr(100),
  state: str(100),
  postalCode: z.string({ error: req }).trim().min(3, req).max(12, "v.too_long").regex(/^[A-Za-z0-9\- ]+$/, "v.postal"),
  country: str(100),
});

export const registerSchema = z
  .object({
    name: str(120),
    email: emailSchema,
    phone: phoneSchema,
    gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]).default("prefer_not_to_say"),
    address: addressSchema,
    password: passwordSchema,
    passwordConfirm: z.string({ error: req }),
    acceptTerms: z.literal(true, { error: "v.accept_terms" }),
    language: z.enum(["ta", "en"]).default("ta"),
  })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "v.password_mismatch" });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email: emailSchema, password: z.string({ error: req }).min(1, req).max(128) });

export const resetRequestSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(100), password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "v.password_mismatch" });

export const profileSchema = z.object({
  name: str(120),
  phone: phoneSchema,
  gender: z.enum(["female", "male", "non_binary", "prefer_not_to_say"]),
  address: addressSchema,
  bio: optStr(600),
  preferredLanguage: z.enum(["ta", "en"]),
  notifyInApp: z.boolean().default(true),
  notifyEmail: z.boolean().default(true),
});

const localized = (max: number) => z.object({ ta: z.string().max(max, "v.too_long").default(""), en: z.string().max(max, "v.too_long").default("") });
const localizedBody = z.object({ ta: z.string().max(200_000, "v.too_long").default(""), en: z.string().max(200_000, "v.too_long").default("") });

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "v.invalid");

export const articleInputSchema = z.object({
  title: localized(300),
  subtitle: localized(400),
  excerpt: localized(600),
  body: localizedBody,
  seoTitle: localized(120).optional(),
  seoDescription: localized(300).optional(),
  slug: localized(300).optional(),
  preferredLanguage: z.enum(["ta", "en"]).default("ta"),
  category: objectId.nullish(),
  tags: z.array(objectId).max(15).default([]),
  location: z.string().trim().max(200).optional(),
  authorNotes: z.string().trim().max(2000).optional(),
  declaration: z.boolean().optional(),
  sources: z.array(z.object({ label: z.string().trim().max(200), url: z.string().trim().max(500).refine((u) => !u || /^https?:\/\//i.test(u), "v.url") })).max(10).default([]),
  featuredImage: objectId.nullish(),
  featuredCaption: localized(500).optional(),
  featuredCredit: z.string().trim().max(200).optional(),
  // staff-only fields (ignored for contributors):
  authorId: objectId.nullish(),
  authorName: z.string().trim().max(150).optional(),
  canonicalUrl: z.string().trim().max(500).refine((u) => !u || /^https?:\/\//i.test(u), "v.url").optional(),
  edition: z.string().trim().max(80).optional(),
  featured: z.boolean().optional(),
  trending: z.boolean().optional(),
  breaking: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;

export const reasonSchema = z.string({ error: req }).trim().min(5, "v.reason_short").max(2000, "v.too_long");

export const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(80).optional(),
  sort: z.enum(["latest", "relevance", "popular"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type FieldErrors = Record<string, string>;

/** Flatten zod issues to `{ "address.city": "v.required" }`. */
export function flattenIssues(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const k = issue.path.join(".") || "_";
    if (!out[k]) out[k] = typeof issue.message === "string" && issue.message.startsWith("v.") ? issue.message : "v.invalid";
  }
  return out;
}
