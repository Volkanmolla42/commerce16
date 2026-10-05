import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";

const pageValidator = schema.doc("pages");
const pageInputValidator = pageValidator.omit("_id", "_creationTime", "updatedAt");

const reservedSlugs = new Set([
  "account",
  "admin",
  "api",
  "cart",
  "checkout",
  "login",
  "opengraph-image",
  "orders",
  "product",
  "robots.txt",
  "search",
  "sitemap.xml",
]);

function assertPageSlug(slug: string) {
  if (slug.length > 80) throw new Error("Sayfa adresi 80 karakteri aşamaz.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Sayfa adresi küçük harf, sayı ve tire içerebilir.");
  }
  if (reservedSlugs.has(slug)) {
    throw new Error("Bu adres mağazanın sistem sayfaları için ayrılmış.");
  }
}

export const list = query({
  args: {},
  returns: v.array(pageValidator),
  handler: async (ctx) => {
    return await ctx.db.query("pages").take(50);
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(pageValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pages")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const create = mutation({
  args: {
    adminSecret: v.string(),
    ...pageInputValidator.fields,
  },
  returns: v.id("pages"),
  handler: async (ctx, args) => {
    const { adminSecret, ...page } = args;
    assertAdminApiSecret(adminSecret);
    assertPageSlug(page.slug);

    const existing = await ctx.db
      .query("pages")
      .withIndex("by_slug", (q) => q.eq("slug", page.slug))
      .first();
    if (existing) throw new Error("Bu sayfa adresi zaten kullanılıyor.");

    return await ctx.db.insert("pages", {
      ...page,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const update = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("pages"),
    ...pageInputValidator.fields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { adminSecret, id, ...page } = args;
    assertAdminApiSecret(adminSecret);
    assertPageSlug(page.slug);

    const current = await ctx.db.get(id);
    if (!current) throw new Error("Sayfa bulunamadı.");
    if (page.slug !== current.slug) {
      const existing = await ctx.db
        .query("pages")
        .withIndex("by_slug", (q) => q.eq("slug", page.slug))
        .first();
      if (existing) throw new Error("Bu sayfa adresi zaten kullanılıyor.");
    }

    await ctx.db.patch(id, {
      ...page,
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("pages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const page = await ctx.db.get(args.id);
    if (!page) throw new Error("Sayfa bulunamadı.");
    await ctx.db.delete(args.id);
    return null;
  },
});
