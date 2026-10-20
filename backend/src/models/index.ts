export * from "./user";
export * from "./taxonomy";
export * from "./media";
export * from "./article";
export * from "./system";

import { connectDB } from "../db";
import { User, Session, AuthToken } from "./user";
import { Category, Tag } from "./taxonomy";
import { MediaAsset } from "./media";
import { Article, ArticleRevision, EditorialReview } from "./article";
import { Notification, SiteSettings, Advertisement, AuditLog, AiUsage, RateLimit, EmailOutbox } from "./system";

/** Creates every declared index. Run via `npm run db:init` (and by the seed script/tests). */
export async function ensureIndexes() {
  await connectDB();
  const all = [User, Session, AuthToken, Category, Tag, MediaAsset, Article, ArticleRevision, EditorialReview, Notification, SiteSettings, Advertisement, AuditLog, AiUsage, RateLimit, EmailOutbox];
  for (const m of all) await m.createIndexes();
}
