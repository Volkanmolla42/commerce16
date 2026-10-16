import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";

const cashOnDeliverySettingsValidator = v.object({
  enabled: v.boolean(),
  fee: v.number(),
  description: v.string(),
});

const bankTransferSettingsValidator = v.object({
  enabled: v.boolean(),
  description: v.string(),
  accounts: v.array(
    v.object({
      id: v.string(),
      bankName: v.string(),
      accountHolder: v.string(),
      iban: v.string(),
    })
  ),
});

// Vitrine dönen PayTR biçimi; merchant kimlikleri yalnız admin biçiminde taşınır.
const publicPaytrSettingsValidator = v.object({
  enabled: v.boolean(),
  testMode: v.boolean(),
  description: v.string(),
});

const paytrSettingsValidator = publicPaytrSettingsValidator.extend({
  merchantId: v.optional(v.string()),
  merchantKey: v.optional(v.string()),
  merchantSalt: v.optional(v.string()),
});

export const storefrontPaymentSettingsValidator = v.object({
  cashOnDelivery: cashOnDeliverySettingsValidator,
  bankTransfer: bankTransferSettingsValidator,
  paytr: publicPaytrSettingsValidator,
});

export const paymentSettingsValidator = v.object({
  key: v.optional(v.literal("payment")),
  cashOnDelivery: cashOnDeliverySettingsValidator,
  bankTransfer: bankTransferSettingsValidator,
  paytr: paytrSettingsValidator,
  updatedAt: v.optional(v.string()),
});

type PaymentSettings = typeof paymentSettingsValidator["type"];

import { DEFAULT_PAYMENT_DESCRIPTIONS } from "../lib/payments";

/** Ayar satırı olmayan mağazada vitrine hiçbir ödeme yöntemi çıkmaz. */
const unsetPaymentSettings: PaymentSettings = {
  cashOnDelivery: { enabled: false, fee: 0, description: DEFAULT_PAYMENT_DESCRIPTIONS.cashOnDelivery },
  bankTransfer: { enabled: false, description: DEFAULT_PAYMENT_DESCRIPTIONS.bankTransfer, accounts: [] },
  paytr: {
    enabled: false,
    testMode: false,
    merchantId: "",
    merchantKey: "",
    merchantSalt: "",
    description: DEFAULT_PAYMENT_DESCRIPTIONS.paytr,
  },
};


export async function readPaymentSettings(
  ctx: QueryCtx | MutationCtx,
): Promise<PaymentSettings> {
  const record = await ctx.db
    .query("paymentSettings")
    .withIndex("by_key", (q) => q.eq("key", "payment"))
    .unique();

  if (!record) {
    return unsetPaymentSettings;
  }

  return {
    cashOnDelivery: {
      ...record.cashOnDelivery,
      description: record.cashOnDelivery.description || DEFAULT_PAYMENT_DESCRIPTIONS.cashOnDelivery,
    },
    bankTransfer: {
      ...record.bankTransfer,
      description: record.bankTransfer.description || DEFAULT_PAYMENT_DESCRIPTIONS.bankTransfer,
    },
    paytr: {
      ...record.paytr,
      description: record.paytr.description || DEFAULT_PAYMENT_DESCRIPTIONS.paytr,
    },
    updatedAt: record.updatedAt,
  };

}


export const getPaymentSettings = query({
  args: {},
  returns: storefrontPaymentSettingsValidator,
  handler: async (ctx) => {
    const settings = await readPaymentSettings(ctx);
    return {
      cashOnDelivery: settings.cashOnDelivery,
      bankTransfer: settings.bankTransfer,
      paytr: {
        enabled: settings.paytr.enabled,
        testMode: settings.paytr.testMode,
        description: settings.paytr.description,
      },
    };
  },
});

export const getPaymentSettingsAdmin = query({
  args: { adminSecret: v.string() },
  returns: paymentSettingsValidator,
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    return await readPaymentSettings(ctx);
  },
});

export const updatePaymentSettings = mutation({
  args: {
    adminSecret: v.string(),
    cashOnDelivery: v.object({
      enabled: v.boolean(),
      fee: v.number(),
      description: v.string(),
    }),
    bankTransfer: v.object({
      enabled: v.boolean(),
      description: v.string(),
      accounts: v.array(
        v.object({
          id: v.string(),
          bankName: v.string(),
          accountHolder: v.string(),
          iban: v.string(),
        })
      ),
    }),
    paytr: v.object({
      enabled: v.boolean(),
      testMode: v.boolean(),
      merchantId: v.optional(v.string()),
      merchantKey: v.optional(v.string()),
      merchantSalt: v.optional(v.string()),
      description: v.string(),
    }),
  },
  returns: paymentSettingsValidator,
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);

    // Temel doğrulamalar
    if (args.cashOnDelivery.fee < 0 || args.cashOnDelivery.fee > 10000) {
      throw new Error("Kapıda ödeme hizmet bedeli 0 ile 10.000 TL arasında olmalıdır.");
    }

    for (const acc of args.bankTransfer.accounts) {
      if (!acc.bankName.trim() || !acc.accountHolder.trim() || !acc.iban.trim()) {
        throw new Error("Tüm banka hesapları için Banka Adı, Hesap Sahibi ve IBAN zorunludur.");
      }
    }

    // Vitrinde görünen açıklamalar yalnız admin panelinden yazılır; kodda örnek metin durmaz.
    if (args.cashOnDelivery.enabled && !args.cashOnDelivery.description.trim()) {
      throw new Error("Kapıda ödeme açıkken müşteriye gösterilecek açıklama zorunludur.");
    }
    if (args.bankTransfer.enabled && (!args.bankTransfer.description.trim() || args.bankTransfer.accounts.length === 0)) {
      throw new Error("Havale / EFT açıkken açıklama ve en az bir banka hesabı zorunludur.");
    }
    if (args.paytr.enabled && !args.paytr.description.trim()) {
      throw new Error("PayTR açıkken müşteriye gösterilecek açıklama zorunludur.");
    }
    if (args.paytr.enabled && !args.paytr.testMode &&
      (!args.paytr.merchantId?.trim() || !args.paytr.merchantKey?.trim() || !args.paytr.merchantSalt?.trim())) {
      throw new Error("PayTR canlı modda Merchant Id, Merchant Key ve Merchant Salt alanlarının tümü zorunludur.");
    }

    const existing = await ctx.db
      .query("paymentSettings")
      .withIndex("by_key", (q) => q.eq("key", "payment"))
      .unique();

    const payload = {
      key: "payment" as const,
      cashOnDelivery: {
        enabled: args.cashOnDelivery.enabled,
        fee: Math.round(args.cashOnDelivery.fee * 100) / 100,
        description: args.cashOnDelivery.description.trim(),
      },
      bankTransfer: {
        enabled: args.bankTransfer.enabled,
        description: args.bankTransfer.description.trim(),
        accounts: args.bankTransfer.accounts.map((acc) => ({
          id: acc.id || `bank-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          bankName: acc.bankName.trim(),
          accountHolder: acc.accountHolder.trim(),
          iban: acc.iban.trim(),
        })),
      },
      paytr: {
        enabled: args.paytr.enabled,
        testMode: args.paytr.testMode,
        merchantId: args.paytr.merchantId?.trim() ?? "",
        merchantKey: args.paytr.merchantKey?.trim() ?? "",
        merchantSalt: args.paytr.merchantSalt?.trim() ?? "",
        description: args.paytr.description.trim(),
      },
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("paymentSettings", payload);
    }

    return payload;
  },
});
