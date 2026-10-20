import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  MONGODB_URI: z.string().optional(),
  MONGODB_DNS_SERVERS: z.string().optional(), // e.g. "8.8.8.8,1.1.1.1" when SRV lookups fail
  MONGODB_DB: z.string().default("dinaidhigai"),
  APP_URL: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().optional(),
  // Zoho Catalyst AppSail injects the listen port as X_ZOHO_CATALYST_LISTEN_PORT.
  PORT: z.coerce.number().default(4000),
  X_ZOHO_CATALYST_LISTEN_PORT: z.coerce.number().optional(),
  SESSION_COOKIE: z.string().default("di_session"),
  SESSION_TTL_DAYS: z.coerce.number().default(14),
  CRON_SECRET: z.string().optional(),

  B2_ENDPOINT: z.string().optional(), // e.g. https://s3.us-west-004.backblazeb2.com
  B2_REGION: z.string().optional(), // e.g. us-west-004
  B2_BUCKET: z.string().optional(),
  B2_KEY_ID: z.string().optional(),
  B2_APPLICATION_KEY: z.string().optional(),
  LOCAL_UPLOAD_DIR: z.string().default(".data/uploads"),

  UPLOAD_MAX_MB: z.coerce.number().default(8),
  UPLOAD_MAX_DIMENSION: z.coerce.number().default(8000),

  AI_PROVIDER: z.enum(["anthropic", "openai", "groq", "openai-compatible"]).default("anthropic"),
  AI_MODEL: z.string().default("openai/gpt-oss-120b"),
  AI_API_KEY: z.string().optional(),
  AI_API_KEYS: z.string().optional(), // comma-separated fallback list, tried in order
  AI_BASE_URL: z.string().optional(),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().default(30),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("Dina Idhigai <no-reply@dinaidhigai.example>"),
});

export type Env = z.infer<typeof schema>;

/** Parsed lazily so `next build` works without runtime secrets. */
export function env(): Env {
  return schema.parse(process.env);
}

export const listenPort = () => env().X_ZOHO_CATALYST_LISTEN_PORT ?? env().PORT;

export const isProd = () => process.env.NODE_ENV === "production";

export function b2Configured(e: Env = env()) {
  return Boolean(e.B2_ENDPOINT && e.B2_BUCKET && e.B2_KEY_ID && e.B2_APPLICATION_KEY);
}

export function aiKeys(e: Env = env()): string[] {
  return [...(e.AI_API_KEYS ?? "").split(","), e.AI_API_KEY ?? ""].map((k) => k.trim()).filter(Boolean);
}
