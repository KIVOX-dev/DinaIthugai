/**
 * Creates the first super administrator.
 *   npm run admin:create -- --email you@example.com --name "Your Name" --password "a-long-passphrase"
 * (or set ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD). Refuses to run if the email already exists.
 */
import mongoose from "mongoose";
import { hashPassword } from "../src/auth/crypto";
import { connectDB } from "../src/db";
import { User, ensureIndexes } from "../src/models";
import { emailSchema, passwordSchema } from "../src/validation/schemas";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

(async () => {
  const email = emailSchema.parse(arg("email") ?? process.env.ADMIN_EMAIL);
  const name = arg("name") ?? process.env.ADMIN_NAME ?? "Super Admin";
  const password = passwordSchema.parse(arg("password") ?? process.env.ADMIN_PASSWORD);
  await connectDB();
  await ensureIndexes();
  if (await User.exists({ normalizedEmail: email })) throw new Error("A user with that email already exists.");
  await User.create({
    name,
    email,
    normalizedEmail: email,
    phone: "+910000000000",
    address: { line1: "-", city: "-", state: "-", postalCode: "000000", country: "India" },
    passwordHash: await hashPassword(password),
    role: "super_admin",
    emailVerifiedAt: new Date(),
    consentAt: new Date(),
    preferredLanguage: "en",
  });
  console.log(`Super administrator created: ${email}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
