import { v } from "convex/values";
import { assertAdminApiSecret } from "./adminAuth";
import { internal } from "./_generated/api";
import { env, internalAction, internalMutation, internalQuery, mutation, query, type ActionCtx } from "./_generated/server";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { getParasutAccessToken, parasutConfig, parasutRequest, ParasutHttpError } from "./parasut";

const invoiceRecordValidator = schema.doc("invoiceRecords");
const invoiceRecipientValidator = v.object({
  type: v.union(v.literal("individual"), v.literal("business")),
  businessTitle: v.optional(v.string()),
  taxNumber: v.optional(v.string()),
  taxOffice: v.optional(v.string()),
});
const invoiceOrderItemValidator = v.object({
  productId: v.string(),
  variantId: v.union(v.string(), v.null()),
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.string(),
  sku: v.union(v.string(), v.null()),
  vatRate: v.union(v.number(), v.null()),
});
const invoiceOrderValidator = v.object({
  orderId: v.id("orders"),
  status: v.union(v.literal("pending"), v.literal("paid"), v.literal("shipped"), v.literal("delivered"), v.literal("cancelled")),
  createdAt: v.string(),
  customer: v.object({ name: v.string(), email: v.string(), phone: v.union(v.string(), v.null()) }),
  recipient: v.union(invoiceRecipientValidator, v.null()),
  address: v.union(v.string(), v.null()),
  city: v.union(v.string(), v.null()),
  district: v.union(v.string(), v.null()),
  items: v.array(invoiceOrderItemValidator),
  total: v.string(),
  couponDiscountKurus: v.number(),
  shippingCostKurus: v.number(),
});

type InvoiceProvider = "adapter" | "parasut";
type InvoiceOrder = {
  orderId: Id<"orders">;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  customer: { name: string; email: string; phone: string | null };
  recipient: { type: "individual" | "business"; businessTitle?: string; taxNumber?: string; taxOffice?: string } | null;
  address: string | null;
  city: string | null;
  district: string | null;
  items: { productId: string; variantId: string | null; description: string; quantity: number; unitPrice: string; sku: string | null; vatRate: number | null }[];
  total: string;
  couponDiscountKurus: number;
  shippingCostKurus: number;
};

function adapterUrl() {
  const value = env.EINVOICE_ADAPTER_URL?.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function adapterConfigured() {
  return Boolean(adapterUrl() && env.EINVOICE_ADAPTER_TOKEN?.trim());
}

function resolveProvider(hasStoredToken: boolean): InvoiceProvider {
  const requested = env.EINVOICE_PROVIDER?.trim().toLocaleLowerCase("tr-TR");
  if (requested === "adapter") return "adapter";
  if (requested === "parasut") return "parasut";
  const config = parasutConfig();
  if (config && (env.PARASUT_INITIAL_REFRESH_TOKEN?.trim() || hasStoredToken)) {
    return "parasut";
  }
  return "adapter";
}

export const getAvailability = query({
  args: {},
  returns: v.object({ configured: v.boolean(), provider: v.union(v.literal("adapter"), v.literal("parasut")) }),
  handler: async (ctx) => {
    const tokenRecord = await ctx.db.query("providerTokens").withIndex("by_provider", (q) => q.eq("provider", "parasut")).first();
    const provider = resolveProvider(Boolean(tokenRecord));
    const configured = provider === "parasut"
      ? Boolean(parasutConfig() && (env.PARASUT_INITIAL_REFRESH_TOKEN?.trim() || tokenRecord))
      : adapterConfigured();
    return { configured, provider };
  },
});

export const listAllAdmin = query({
  args: { adminSecret: v.string() },
  returns: v.array(invoiceRecordValidator),
  handler: async (ctx, { adminSecret }) => {
    assertAdminApiSecret(adminSecret);
    return await ctx.db.query("invoiceRecords").order("desc").take(100);
  },
});

export const getOrderForInvoice = internalQuery({
  args: { orderId: v.id("orders") },
  returns: v.union(invoiceOrderValidator, v.null()),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    return {
      orderId: order._id,
      status: order.status,
      createdAt: new Date(order._creationTime).toISOString(),
      customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone ?? null },
      recipient: order.invoiceRecipient ?? null,
      address: order.shippingAddress ?? null,
      city: order.city ?? null,
      district: order.district ?? null,
      items: order.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        description: item.title,
        quantity: item.quantity,
        unitPrice: item.price,
        sku: item.sku ?? null,
        vatRate: item.vatRate ?? null,
      })),
      total: order.total,
      couponDiscountKurus: order.couponDiscountKurus ?? 0,
      shippingCostKurus: order.shippingCostKurus ?? 0,
    };
  },
});

export const beginIssue = internalMutation({
  args: { orderId: v.id("orders"), provider: v.union(v.literal("adapter"), v.literal("parasut")) },
  returns: v.union(v.id("invoiceRecords"), v.null()),
  handler: async (ctx, { orderId, provider }) => {
    const order = await ctx.db.get(orderId);
    if (!order || order.status !== "paid") return null;
    const existing = await ctx.db.query("invoiceRecords")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .first();
    const now = Date.now();
    if (existing?.status === "issued" || existing?.status === "review") return null;
    if (existing?.status === "processing" && now - existing.updatedAt < 10 * 60_000) return null;
    if (existing?.status === "processing" && existing.provider === "parasut") {
      await ctx.db.patch(existing._id, {
        status: "review",
        error: "Paraşüt işlemi yarıda kaldı. Olası mükerrer belgeyi önlemek için sipariş Paraşüt panelinde kontrol edilmeli.",
        updatedAt: now,
      });
      return null;
    }
    if (existing) {
      await ctx.db.patch(existing._id, {
        provider,
        status: "processing",
        error: undefined,
        attempts: existing.attempts + 1,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("invoiceRecords", {
      orderId,
      provider,
      status: "processing",
      attempts: 1,
      updatedAt: now,
    });
  },
});

export const recordFailure = internalMutation({
  args: {
    invoiceId: v.id("invoiceRecords"),
    status: v.union(v.literal("failed"), v.literal("not_configured"), v.literal("review")),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { invoiceId, status, error }) => {
    const invoice = await ctx.db.get(invoiceId);
    if (!invoice || invoice.status === "issued") return null;
    await ctx.db.patch(invoiceId, { status, error: error.slice(0, 300), updatedAt: Date.now() });
    return null;
  },
});

export const recordParasutInvoice = internalMutation({
  args: { invoiceId: v.id("invoiceRecords"), providerInvoiceId: v.string() },
  returns: v.null(),
  handler: async (ctx, { invoiceId, providerInvoiceId }) => {
    const invoice = await ctx.db.get(invoiceId);
    if (!invoice || invoice.status === "issued") return null;
    await ctx.db.patch(invoiceId, { providerInvoiceId: providerInvoiceId.slice(0, 160), updatedAt: Date.now() });
    return null;
  },
});

export const recordParasutJob = internalMutation({
  args: {
    invoiceId: v.id("invoiceRecords"),
    documentType: v.union(v.literal("e_fatura"), v.literal("e_arsiv")),
    trackableJobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { invoiceId, documentType, trackableJobId }) => {
    const invoice = await ctx.db.get(invoiceId);
    if (!invoice || invoice.status === "issued") return null;
    await ctx.db.patch(invoiceId, {
      documentType,
      trackableJobId: trackableJobId.slice(0, 160),
      status: "processing",
      error: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getInvoiceWorkflow = internalQuery({
  args: { invoiceId: v.id("invoiceRecords") },
  returns: v.union(invoiceRecordValidator, v.null()),
  handler: async (ctx, { invoiceId }) => await ctx.db.get(invoiceId),
});

export const recordIssued = internalMutation({
  args: {
    invoiceId: v.id("invoiceRecords"),
    documentType: v.union(v.literal("e_fatura"), v.literal("e_arsiv")),
    providerReference: v.string(),
    documentUrl: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.status === "issued") return null;
    await ctx.db.patch(invoice._id, {
      status: "issued",
      documentType: args.documentType,
      providerReference: args.providerReference.slice(0, 160),
      documentUrl: args.documentUrl ?? undefined,
      error: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function resourceId(value: unknown) {
  const resource = asRecord(value);
  return typeof resource?.id === "string" && resource.id ? resource.id : null;
}

function resourceList(value: unknown) {
  const body = asRecord(value);
  if (Array.isArray(body?.data)) return body.data.map(asRecord).filter((resource): resource is Record<string, unknown> => resource !== null);
  const one = asRecord(body?.data);
  return one ? [one] : [];
}

function centsFromPrice(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("Sipariş satırındaki fiyat geçersiz.");
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount)) throw new Error("Sipariş satırındaki fiyat güvenli sınırı aşıyor.");
  return amount;
}

function netPriceFromGross(grossCents: number, vatRate: number) {
  return Number(((grossCents / 100) / (1 + vatRate / 100)).toFixed(6));
}

async function findOrCreateContact(ctx: ActionCtx, accessToken: string, order: InvoiceOrder) {
  const recipient = order.recipient;
  const filterName = recipient?.type === "business" && recipient.taxNumber ? "tax_number" : "email";
  const filterValue = filterName === "tax_number" ? recipient?.taxNumber : order.customer.email;
  const query = new URLSearchParams({ [`filter[${filterName}]`]: filterValue ?? order.customer.email });
  const matches = resourceList(await parasutRequest(ctx, accessToken, `contacts?${query.toString()}`));
  const existingId = resourceId(matches[0]);
  if (existingId) return existingId;

  const attributes: Record<string, unknown> = {
    name: (recipient?.type === "business" ? recipient.businessTitle : order.customer.name)?.slice(0, 200) || order.customer.name.slice(0, 200),
    email: order.customer.email,
    contact_type: recipient?.type === "business" ? "company" : "person",
    account_type: "customer",
    country: "Türkiye",
    ...(order.customer.phone ? { phone: order.customer.phone } : {}),
    ...(order.address ? { address: order.address.slice(0, 500) } : {}),
    ...(order.city ? { city: order.city } : {}),
    ...(order.district ? { district: order.district } : {}),
    ...(recipient?.type === "business" && recipient.taxNumber ? { tax_number: recipient.taxNumber } : {}),
    ...(recipient?.type === "business" && recipient.taxOffice ? { tax_office: recipient.taxOffice } : {}),
  };
  const created = await parasutRequest(ctx, accessToken, "contacts", {
    method: "POST",
    body: JSON.stringify({ data: { type: "contacts", attributes } }),
  });
  const id = resourceId(asRecord(created)?.data);
  if (!id) throw new Error("Paraşüt müşteri kaydı oluşturdu ancak müşteri kimliği dönmedi.");
  return id;
}

async function findOrCreateProduct(ctx: ActionCtx, accessToken: string, input: { sku: string; name: string; vatRate: number; netPrice: number }) {
  const query = new URLSearchParams({ "filter[code]": input.sku });
  const matches = resourceList(await parasutRequest(ctx, accessToken, `products?${query.toString()}`));
  const existingId = resourceId(matches[0]);
  if (existingId) return existingId;
  const created = await parasutRequest(ctx, accessToken, "products", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "products",
        attributes: {
          code: input.sku,
          name: input.name.slice(0, 200),
          vat_rate: input.vatRate,
          unit: "Adet",
          list_price: input.netPrice,
          currency: "TRL",
          inventory_tracking: false,
        },
      },
    }),
  });
  const id = resourceId(asRecord(created)?.data);
  if (!id) throw new Error("Paraşüt ürün kaydı oluşturdu ancak ürün kimliği dönmedi.");
  return id;
}

async function chooseDocumentType(ctx: ActionCtx, accessToken: string, order: InvoiceOrder): Promise<"e_fatura" | "e_arsiv"> {
  if (order.recipient?.type !== "business" || !order.recipient.taxNumber) return "e_arsiv";
  const query = new URLSearchParams({ "filter[vkn]": order.recipient.taxNumber });
  const inboxes = resourceList(await parasutRequest(ctx, accessToken, `e_invoice_inboxes?${query.toString()}`));
  return inboxes.length > 0 ? "e_fatura" : "e_arsiv";
}

async function issueParasut(ctx: ActionCtx, invoiceId: Id<"invoiceRecords">, order: InvoiceOrder) {
  if (order.items.some((item) => item.vatRate === null || !Number.isFinite(item.vatRate) || item.vatRate < 0 || item.vatRate > 100)) {
    await ctx.runMutation(internal.invoices.recordFailure, {
      invoiceId,
      status: "not_configured",
      error: "Fatura için ürünlerin KDV oranları gerekli. Yönetim panelinden her ürüne oran tanımlayıp faturayı yeniden deneyin.",
    });
    return;
  }
  const shippingVatRateValue = env.PARASUT_SHIPPING_VAT_RATE?.trim();
  const shippingVatRate = order.shippingCostKurus > 0 && shippingVatRateValue ? Number(shippingVatRateValue) : null;
  if (order.shippingCostKurus > 0 && (!Number.isFinite(shippingVatRate) || shippingVatRate! < 0 || shippingVatRate! > 100)) {
    await ctx.runMutation(internal.invoices.recordFailure, {
      invoiceId,
      status: "not_configured",
      error: "Kargo ücreti için PARASUT_SHIPPING_VAT_RATE yapılandırılmalı.",
    });
    return;
  }

  let providerInvoiceId: string | null = null;
  let invoiceCreateAttempted = false;
  try {
    const accessToken = await getParasutAccessToken(ctx);
    const contactId = await findOrCreateContact(ctx, accessToken, order);
    const discountRate = order.couponDiscountKurus > 0
      ? Math.min(100, order.couponDiscountKurus / order.items.reduce((sum, item) => sum + centsFromPrice(item.unitPrice) * item.quantity, 0) * 100)
      : 0;
    const productsByCode = new Map<string, string>();
    const details = [];
    for (const item of order.items) {
      const vatRate = item.vatRate!;
      const grossCents = centsFromPrice(item.unitPrice);
      const code = (item.sku?.trim() || `WEB-${item.productId}`).slice(0, 64);
      let productId = productsByCode.get(code);
      if (!productId) {
        productId = await findOrCreateProduct(ctx, accessToken, {
          sku: code,
          name: item.description,
          vatRate,
          netPrice: netPriceFromGross(grossCents, vatRate),
        });
        productsByCode.set(code, productId);
      }
      details.push({
        type: "sales_invoice_details",
        attributes: {
          description: item.description.slice(0, 300),
          quantity: item.quantity,
          unit_price: netPriceFromGross(grossCents, vatRate),
          vat_rate: vatRate,
          ...(discountRate > 0 ? { discount_type: "percentage", discount_value: Number(discountRate.toFixed(6)) } : {}),
        },
        relationships: { product: { data: { id: productId, type: "products" } } },
      });
    }
    if (order.shippingCostKurus > 0 && shippingVatRate !== null) {
      const code = "WEB-SHIPPING";
      let productId = productsByCode.get(code);
      if (!productId) {
        productId = await findOrCreateProduct(ctx, accessToken, {
          sku: code,
          name: "Kargo ücreti",
          vatRate: shippingVatRate,
          netPrice: netPriceFromGross(order.shippingCostKurus, shippingVatRate),
        });
      }
      details.push({
        type: "sales_invoice_details",
        attributes: {
          description: "Kargo ücreti",
          quantity: 1,
          unit_price: netPriceFromGross(order.shippingCostKurus, shippingVatRate),
          vat_rate: shippingVatRate,
        },
        relationships: { product: { data: { id: productId, type: "products" } } },
      });
    }

    invoiceCreateAttempted = true;
    const createdInvoice = await parasutRequest(ctx, accessToken, "sales_invoices", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "sales_invoices",
          attributes: {
            item_type: "invoice",
            description: `Web siparişi ${order.orderId}`.slice(0, 255),
            issue_date: new Date().toISOString().slice(0, 10),
            due_date: new Date().toISOString().slice(0, 10),
            currency: "TRL",
            exchange_rate: 1,
            billing_address: order.address?.slice(0, 500) ?? "",
            billing_phone: order.customer.phone ?? "",
            ...(order.city ? { city: order.city } : {}),
            ...(order.district ? { district: order.district } : {}),
            ...(order.recipient?.type === "business" && order.recipient.taxNumber ? { tax_number: order.recipient.taxNumber } : {}),
            ...(order.recipient?.type === "business" && order.recipient.taxOffice ? { tax_office: order.recipient.taxOffice } : {}),
          },
          relationships: {
            contact: { data: { id: contactId, type: "contacts" } },
            details: { data: details },
          },
        },
      }),
    });
    providerInvoiceId = resourceId(asRecord(createdInvoice)?.data);
    if (!providerInvoiceId) throw new Error("Paraşüt satış faturası kimliği döndürmedi.");
    await ctx.runMutation(internal.invoices.recordParasutInvoice, { invoiceId, providerInvoiceId });

    const documentType = await chooseDocumentType(ctx, accessToken, order);
    const resourceType = documentType === "e_fatura" ? "e_invoices" : "e_archives";
    const documentJob = await parasutRequest(ctx, accessToken, resourceType, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: resourceType,
          relationships: { sales_invoice: { data: { id: providerInvoiceId, type: "sales_invoices" } } },
        },
      }),
    });
    const jobId = resourceId(asRecord(documentJob)?.data);
    if (!jobId) throw new Error("Paraşüt e-belge kuyruğu takip kimliği döndürmedi.");
    await ctx.runMutation(internal.invoices.recordParasutJob, { invoiceId, documentType, trackableJobId: jobId });
    await ctx.scheduler.runAfter(3_000, internal.invoices.pollParasutDocument, { invoiceId, attempt: 0 });
  } catch (cause) {
    const isAmbiguousCreate = invoiceCreateAttempted && !(cause instanceof ParasutHttpError && cause.status < 500);
    await ctx.runMutation(internal.invoices.recordFailure, {
      invoiceId,
      status: providerInvoiceId || isAmbiguousCreate ? "review" : cause instanceof Error && /yapılandırılmamış|eksik|tanımlanmamış/i.test(cause.message) ? "not_configured" : "failed",
      error: providerInvoiceId || isAmbiguousCreate
        ? "Paraşüt satış faturası oluşturulmuş olabilir; mükerrer belgeyi önlemek için Paraşüt panelinde siparişi kontrol edin."
        : cause instanceof Error ? cause.message : "Paraşüt fatura işlemi tamamlanamadı.",
    });
  }
}

export const pollParasutDocument = internalAction({
  args: { invoiceId: v.id("invoiceRecords"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, { invoiceId, attempt }) => {
    const invoice = await ctx.runQuery(internal.invoices.getInvoiceWorkflow, { invoiceId });
    if (!invoice || invoice.status !== "processing" || invoice.provider !== "parasut" || !invoice.trackableJobId || !invoice.providerInvoiceId || !invoice.documentType) return null;
    if (attempt >= 30) {
      await ctx.runMutation(internal.invoices.recordFailure, {
        invoiceId,
        status: "review",
        error: "Paraşüt e-belge işlemi zamanında tamamlanmadı. Paraşüt panelinden belge durumunu kontrol edin.",
      });
      return null;
    }

    try {
      const accessToken = await getParasutAccessToken(ctx);
      const job = await parasutRequest(ctx, accessToken, `trackable_jobs/${encodeURIComponent(invoice.trackableJobId)}`);
      const jobAttributes = asRecord(asRecord(job.data)?.attributes);
      const jobStatus = jobAttributes?.status;
      if (jobStatus === "pending" || jobStatus === "running") {
        await ctx.scheduler.runAfter(5_000, internal.invoices.pollParasutDocument, { invoiceId, attempt: attempt + 1 });
        return null;
      }
      if (jobStatus !== "done") {
        await ctx.runMutation(internal.invoices.recordFailure, {
          invoiceId,
          status: "review",
          error: "Paraşüt e-belge kuyruğu hata döndürdü. Satış faturası mevcut; Paraşüt panelinde kontrol edin.",
        });
        return null;
      }

      const sale = await parasutRequest(ctx, accessToken, `sales_invoices/${encodeURIComponent(invoice.providerInvoiceId)}?include=active_e_document`);
      const saleData = asRecord(sale.data);
      const relationships = asRecord(saleData?.relationships);
      const activeDocument = asRecord(asRecord(relationships?.active_e_document)?.data);
      const documentId = resourceId(activeDocument);
      const actualDocumentType = activeDocument?.type === "e_invoices" ? "e_fatura" : activeDocument?.type === "e_archives" ? "e_arsiv" : invoice.documentType;
      const attributes = asRecord(saleData?.attributes);
      const reference = (typeof attributes?.invoice_no === "string" && attributes.invoice_no)
        || (documentId ? `${actualDocumentType === "e_fatura" ? "e-Fatura" : "e-Arşiv"} ${documentId}` : null);
      if (!documentId || !reference) {
        await ctx.runMutation(internal.invoices.recordFailure, {
          invoiceId,
          status: "review",
          error: "Paraşüt işi tamamlandı ancak resmi belge numarası dönmedi. Paraşüt panelinden kontrol edin.",
        });
        return null;
      }
      await ctx.runMutation(internal.invoices.recordIssued, {
        invoiceId,
        documentType: actualDocumentType,
        providerReference: reference,
        documentUrl: null,
      });
    } catch {
      await ctx.runMutation(internal.invoices.recordFailure, {
        invoiceId,
        status: "review",
        error: "Paraşüt e-belge durumu doğrulanamadı. Mükerrer işlem yapmamak için panelde kontrol edin.",
      });
    }
    return null;
  },
});

export const issueForOrder = internalAction({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order: InvoiceOrder | null = await ctx.runQuery(internal.invoices.getOrderForInvoice, { orderId });
    if (!order || order.status !== "paid") return null;
    const tokenRecord = await ctx.runQuery(internal.parasut.getStoredTokens, {});
    const provider = resolveProvider(Boolean(tokenRecord));
    const invoiceId: Id<"invoiceRecords"> | null = await ctx.runMutation(internal.invoices.beginIssue, { orderId, provider });
    if (!invoiceId) return null;

    if (provider === "parasut") {
      if (!parasutConfig()) {
        await ctx.runMutation(internal.invoices.recordFailure, {
          invoiceId,
          status: "not_configured",
          error: "Paraşüt client, company ve token şifreleme ayarları eksik.",
        });
        return null;
      }
      await issueParasut(ctx, invoiceId, order);
      return null;
    }

    const url = adapterUrl();
    const token = env.EINVOICE_ADAPTER_TOKEN?.trim();
    if (!url || !token) {
      await ctx.runMutation(internal.invoices.recordFailure, {
        invoiceId,
        status: "not_configured",
        error: "Paraşüt veya GİB yetkili entegratör adapter ayarları yapılandırılmamış.",
      });
      return null;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `commerce-order-${orderId}`,
        },
        body: JSON.stringify({ schemaVersion: 1, idempotencyKey: `commerce-order-${orderId}`, documentTypeHint: "auto", currency: "TRY", order }),
        signal: AbortSignal.timeout(20_000),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result !== "object") {
        throw new Error(`Fatura entegratörü HTTP ${response.status} yanıtı döndürdü.`);
      }
      const body = result as Record<string, unknown>;
      if ((body.documentType !== "e_fatura" && body.documentType !== "e_arsiv") ||
        typeof body.providerReference !== "string" || !body.providerReference.trim()) {
        throw new Error("Fatura entegratörü belge türü veya referans numarası döndürmedi.");
      }
      let documentUrl: string | null = null;
      if (typeof body.documentUrl === "string") {
        try {
          const parsedUrl = new URL(body.documentUrl);
          if (parsedUrl.protocol === "https:") documentUrl = parsedUrl.toString();
        } catch {
          // An invalid optional link does not invalidate a confirmed invoice.
        }
      }
      await ctx.runMutation(internal.invoices.recordIssued, {
        invoiceId,
        documentType: body.documentType,
        providerReference: body.providerReference.slice(0, 160),
        documentUrl,
      });
    } catch (cause) {
      await ctx.runMutation(internal.invoices.recordFailure, {
        invoiceId,
        status: "failed",
        error: cause instanceof Error ? cause.message : "Fatura entegratörüne ulaşılamadı.",
      });
    }
    return null;
  },
});

export const retry = mutation({
  args: { adminSecret: v.string(), orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { adminSecret, orderId }) => {
    assertAdminApiSecret(adminSecret);
    const order = await ctx.db.get(orderId);
    if (!order || order.status !== "paid") throw new Error("Fatura yalnızca ödemesi alınmış sipariş için düzenlenebilir.");
    const existing = await ctx.db.query("invoiceRecords").withIndex("by_order", (q) => q.eq("orderId", orderId)).first();
    if (existing?.status === "review") throw new Error("Olası mükerrer belge var. Paraşüt panelinde kontrol edip kaydı uzlaştırın.");
    await ctx.scheduler.runAfter(0, internal.invoices.issueForOrder, { orderId });
    return null;
  },
});
