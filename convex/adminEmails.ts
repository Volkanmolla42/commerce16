import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { assertAdminApiSecret } from "./adminAuth";
import schema from "./schema";
import { EMAIL_TEMPLATES, type EmailPreviewStore } from "./emails/registry";
import { readPaymentSettings } from "./payments";
import { readStoreSettings } from "./settings";

/** Gönderilen her e-postanın tarihsel denetim kaydı. Tek yazıcı: emails/send.ts */
export const recordEmailLog = internalMutation({
  args: {
    templateKey: v.string(),
    recipient: v.string(),
    subject: v.string(),
    htmlBody: v.optional(v.string()),
    textBody: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("failed")),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLogs", { ...args });
    return null;
  },
});

export const listSentEmailsAdmin = query({
  args: {
    adminSecret: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(schema.doc("emailLogs")),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("emailLogs")
      .order("desc")
      .take(limit);
  },
});

const templatePreviewValidator = v.object({
  key: v.string(),
  name: v.string(),
  category: v.union(
    v.literal("order"),
    v.literal("customer"),
    v.literal("marketing"),
    v.literal("admin")
  ),
  description: v.string(),
  subject: v.string(),
  bodyHtml: v.string(),
  bodyText: v.string(),
});

/**
 * Şablon listesi: her satır, gerçek şablonun mağazanın kendi kimliği ve örnek sipariş
 * verisiyle üretilmiş çıktısıdır. Önizlemede görünen ile müşteriye giden e-posta aynıdır.
 */
export const listTemplatesAdmin = query({
  args: { adminSecret: v.string() },
  returns: v.array(templatePreviewValidator),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const settings = await readStoreSettings(ctx);
    const payments = await readPaymentSettings(ctx);
    const store: EmailPreviewStore = {
      storeName: settings.storeName,
      storeEmail: settings.email,
      storePhone: settings.phone,
      lowStockThreshold: settings.lowStockThreshold,
      bankAccounts: payments.bankTransfer.accounts.map(({ bankName, accountHolder, iban }) => ({
        bankName,
        accountHolder,
        iban,
      })),
      bankTransferInstructions: payments.bankTransfer.description ?? "",
    };

    return EMAIL_TEMPLATES.map((template) => {
      const content = template.preview(store);
      return {
        key: template.key,
        name: template.name,
        category: template.category,
        description: template.description,
        subject: content.subject,
        bodyHtml: content.html,
        bodyText: content.text,
      };
    });
  },
});
