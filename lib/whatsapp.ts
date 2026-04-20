import { prisma } from "./prisma";

interface QueueWhatsappOptions {
  to: string;
  contactName: string;
  campaignName: string;
  body: string;
  recipientType: "admin" | "student";
  recipientId: string;
  notificationType: string;
  relatedExamId?: string;
  mediaUrl?: string;
  templateVariables?: string[];
  attributes?: Record<string, string>;
}

function normalizePhoneNumber(value: string): string {
  // Sandeshai expects plain digits without '+', e.g. 917805076045
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    // Already has international format — just strip the '+'
    return trimmed.slice(1).replace(/\D/g, "");
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  const defaultCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE;
  if (defaultCountryCode) {
    return `${defaultCountryCode.replace(/\D/g, "")}${digitsOnly}`;
  }

  return digitsOnly;
}

async function sendWhatsappMessage(opts: QueueWhatsappOptions) {
  const apiKey = process.env.SANDESHAI_API_KEY;
  console.log("[whatsapp] WHATSAPP_ENABLED:", process.env.WHATSAPP_ENABLED, "apiKey present:", !!apiKey);

  if (process.env.WHATSAPP_ENABLED !== "true") {
    throw new Error("WhatsApp delivery is disabled. Set WHATSAPP_ENABLED=true to send messages.");
  }

  if (!apiKey) {
    throw new Error("SandeshAI API key is missing.");
  }

  const payload = {
    apiKey,
    campaignName: opts.campaignName,
    whatsappNumber: normalizePhoneNumber(opts.to),
    contactName: opts.contactName,
    attributes: opts.attributes,
    media: opts.mediaUrl,
    templateVariables: opts.templateVariables,
  };

  console.log("[whatsapp] Payload (no apiKey):", JSON.stringify({ ...payload, apiKey: "***" }));

  const res = await fetch("https://api.sandeshai.com/whatsapp/campaign/api/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  console.log("[whatsapp] Sandeshai response status:", res.status, "body:", data);

  if (!res.ok) {
    throw new Error(
      typeof data?.msg === "string"
        ? data.msg
        : `SandeshAI API request failed with status ${res.status}`
    );
  }

  return typeof data?.msg === "string" ? data.msg : undefined;
}

/** Queue a WhatsApp notification and attempt delivery immediately. */
export async function queueWhatsapp(opts: QueueWhatsappOptions): Promise<boolean> {
  // Early-exit when disabled — skip all DB writes, no-op for load testing
  if (process.env.WHATSAPP_ENABLED !== "true") {
    return false;
  }

  console.log("[whatsapp] queueWhatsapp called for", opts.to, "campaign:", opts.campaignName);

  let notification: { id: string } | null = null;

  try {
    notification = await prisma.whatsAppNotification.create({
      data: {
        recipientType: opts.recipientType,
        recipientId: opts.recipientId,
        recipientPhone: normalizePhoneNumber(opts.to),
        notificationType: opts.notificationType,
        messageBody: opts.body,
        mediaUrl: opts.mediaUrl,
        status: "pending",
        relatedExamId: opts.relatedExamId,
      },
    });
  } catch (dbErr) {
    console.error("[whatsapp] Failed to create WhatsAppNotification record:", dbErr);
    return false;
  }

  try {
    console.log("[whatsapp] Sending via Sandeshai to", normalizePhoneNumber(opts.to));
    const providerMessageId = await sendWhatsappMessage(opts);
    console.log("[whatsapp] Sent successfully, providerMessageId:", providerMessageId);

    await prisma.whatsAppNotification.update({
      where: { id: notification.id },
      data: { status: "sent", sentAt: new Date(), providerMessageId },
    });
    return true;
  } catch (err) {
    console.error("[whatsapp] Failed to send WhatsApp message to", opts.to, err);
    await prisma.whatsAppNotification.update({
      where: { id: notification.id },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        failedReason: err instanceof Error ? err.message : String(err),
      },
    });
    return false;
  }
}

export function examInfoWhatsappMessage(args: {
  studentName: string;
  examTitle: string;
  examUrl: string;
  examPassword: string;
  startAt: Date | null;
  endAt: Date | null;
  timeLimitMinutes: number | null;
  instructions: string | null;
}) {
  const lines = [
    `Hello ${args.studentName},`,
    `You are registered for: ${args.examTitle}`,
    `Exam link: ${args.examUrl}`,
    `Exam password: ${args.examPassword}`,
  ];

  if (args.startAt) lines.push(`Starts: ${args.startAt.toLocaleString("en-IN")}`);
  if (args.endAt) lines.push(`Ends: ${args.endAt.toLocaleString("en-IN")}`);
  if (args.timeLimitMinutes) lines.push(`Time limit: ${args.timeLimitMinutes} minutes`);
  if (args.instructions) lines.push(`Info: ${args.instructions.slice(0, 500)}`);

  return lines.join("\n");
}

export function examResultWhatsappMessage(args: {
  studentName: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  isPassed: boolean;
  resultUrl: string;
}) {
  return [
    `Hello ${args.studentName},`,
    `Your result for ${args.examTitle} is ready.`,
    `Score: ${args.score} / ${args.totalMarks}`,
    `Percentage: ${args.percentage.toFixed(1)}%`,
    `Status: ${args.isPassed ? "PASSED" : "FAILED"}`,
    `View result: ${args.resultUrl}`,
  ].join("\n");
}
