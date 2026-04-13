import slugifyLib from "slugify";
import crypto from "crypto";

export function generateSlug(title: string): string {
  const base = slugifyLib(title, { lower: true, strict: true, trim: true });
  const suffix = crypto.randomBytes(3).toString("hex"); // 6 hex chars
  return `${base}-${suffix}`;
}
