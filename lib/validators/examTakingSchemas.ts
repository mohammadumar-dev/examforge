import { z } from "zod";

export const verifyAccessSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(120).optional(),
});

export const saveResponseSchema = z.object({
  questionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()),
  isSkipped: z.boolean().default(false),
});

export const heartbeatSchema = z.object({
  event: z.enum(["tab_switch", "fullscreen_exit", "ping"]),
});
