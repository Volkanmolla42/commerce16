import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import type { EmailContent } from "./content";
import { senderAddress, siteUrl } from "./config";
import type { EmailTemplateKey } from "./registry";
import { sendViaResend, type SendResult } from "./resend";

/** Gönderim sonucunun iş mantığındaki karşılığı. */
export type EmailOutcome = "sent" | "failed" | "not_configured" | "review";

export function outcomeOf(result: SendResult): EmailOutcome {
  if (result.ok) return "sent";
  if (result.status === 0) return "not_configured";
  if (result.status >= 500 || /zaman aşımı|timeout/i.test(result.error ?? "")) {
    return "review";
  }
  return "failed";
}

export interface SendEmailArgs {
  to: string;
  storeName: string;
  templateKey: EmailTemplateKey;
  content: EmailContent;
  replyTo?: string;
  idempotencyKey?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * E-posta göndermenin tek kapısı: iletir ve sonucu denetim kaydına yazar.
 * Çağıran taraf HTTP, gönderen başlığı ve log detaylarıyla uğraşmaz.
 */
export async function sendEmail(
  ctx: GenericActionCtx<DataModel>,
  args: SendEmailArgs
): Promise<EmailOutcome> {
  // Alıcı, gönderen veya bağlantı tabanı eksikse postaya çıkmaz; uydurma bir değerle gönderim yapılmaz.
  const from = senderAddress(args.storeName);
  if (!args.to.trim() || !from || !siteUrl()) {
    return "not_configured";
  }

  const result = await sendViaResend({
    to: args.to,
    from,
    subject: args.content.subject,
    html: args.content.html,
    text: args.content.text,
    replyTo: args.replyTo,
    idempotencyKey: args.idempotencyKey,
  });

  const outcome = outcomeOf(result);
  await ctx.runMutation(internal.adminEmails.recordEmailLog, {
    templateKey: args.templateKey,
    recipient: args.to,
    subject: args.content.subject,
    htmlBody: args.content.html,
    textBody: args.content.text,
    status: outcome === "sent" ? "sent" : "failed",
    resendId: result.messageId,
    error: result.error,
    metadata: args.metadata,
  });

  return outcome;
}
