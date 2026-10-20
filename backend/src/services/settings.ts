import { connectDB } from "../db";
import { SiteSettings, type SettingsDoc } from "../models";

export type Settings = SettingsDoc & { _id: unknown };

/** Singleton settings document; created with defaults on first access. */
export async function getSettings(): Promise<SettingsDoc> {
  await connectDB();
  let s = await SiteSettings.findOne({ key: "site" }).lean();
  if (!s) {
    try {
      await SiteSettings.create({ key: "site" });
    } catch {
      /* concurrent creator won */
    }
    s = await SiteSettings.findOne({ key: "site" }).lean();
  }
  return s as SettingsDoc;
}

export async function updateSettings(patch: Record<string, unknown>) {
  await connectDB();
  await getSettings();
  await SiteSettings.updateOne({ key: "site" }, { $set: patch });
}
