import { z } from "zod";

export const updateAccessRuleSchema = z.object({
  accessType: z.enum(["public_link", "specific_emails"]),
});

export const addEmailsSchema = z.object({
  emails: z
    .array(z.string().email().toLowerCase())
    .min(1, "At least one email required")
    .max(500, "Maximum 500 emails per batch"),
});
