import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";

export const paymentSettingsValidator = v.object({
  key: v.optional(v.literal("payment")),
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
  updatedAt: v.optional(v.string()),
});

export const defaultPaymentSettings = {
  cashOnDelivery: {
    enabled: true,
    fee: 0,
    description: "Siparişinizi kapıda nakit veya banka/kredi kartı ile teslim alırken ödeyebilirsiniz.",
  },
  bankTransfer: {
    enabled: true,
    description: "Siparişinizi oluşturduktan sonra belirtilen banka hesabımıza sipariş numaranızı açıklama kısmına yazarak havale/EFT yapınız.",
    accounts: [
      {
        id: "bank-1",
        bankName: "Ziraat Bankası",
        accountHolder: "Mağaza Ticaret A.Ş.",
        iban: "TR12 0001 0000 0000 0000 0000 01",
      },
      {
        id: "bank-2",
        bankName: "Garanti BBVA",
        accountHolder: "Mağaza Ticaret A.Ş.",
        iban: "TR62 0006 2000 0000 0000 0000 02",
      },
    ],
  },
  paytr: {
    enabled: true,
    testMode: true,
    merchantId: "",
    merchantKey: "",
    merchantSalt: "",
    description: "PayTR 256-bit SSL korumalı altyapısı ile kredi kartı veya banka kartınızla güvenle ödeyin (Demo Modu).",
  },
};

export const getPaymentSettings = query({
  args: {},
  returns: paymentSettingsValidator,
  handler: async (ctx) => {
    const record = await ctx.db
      .query("paymentSettings")
      .withIndex("by_key", (q) => q.eq("key", "payment"))
      .unique();

    if (!record) {
      return defaultPaymentSettings;
    }

    return {
      cashOnDelivery: {
        enabled: record.cashOnDelivery?.enabled ?? defaultPaymentSettings.cashOnDelivery.enabled,
        fee: record.cashOnDelivery?.fee ?? defaultPaymentSettings.cashOnDelivery.fee,
        description: record.cashOnDelivery?.description ?? defaultPaymentSettings.cashOnDelivery.description,
      },
      bankTransfer: {
        enabled: record.bankTransfer?.enabled ?? defaultPaymentSettings.bankTransfer.enabled,
        description: record.bankTransfer?.description ?? defaultPaymentSettings.bankTransfer.description,
        accounts: record.bankTransfer?.accounts ?? defaultPaymentSettings.bankTransfer.accounts,
      },
      paytr: {
        enabled: record.paytr?.enabled ?? defaultPaymentSettings.paytr.enabled,
        testMode: record.paytr?.testMode ?? defaultPaymentSettings.paytr.testMode,
        merchantId: record.paytr?.merchantId ?? defaultPaymentSettings.paytr.merchantId,
        merchantKey: record.paytr?.merchantKey ?? defaultPaymentSettings.paytr.merchantKey,
        merchantSalt: record.paytr?.merchantSalt ?? defaultPaymentSettings.paytr.merchantSalt,
        description: record.paytr?.description ?? defaultPaymentSettings.paytr.description,
      },
      updatedAt: record.updatedAt,
    };
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
