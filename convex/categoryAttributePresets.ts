import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import schema from "./schema";
import { assertAdminApiSecret } from "./adminAuth";
import { normalizeAttributeLabel, parseAttributeTemplate } from "../lib/catalog/attributes";

const presetValidator = schema.doc("categoryAttributePresets");
const templateValidator = schema.doc("categoryAttributePresets").omit(
  "_id", "_creationTime", "normalizedLabel",
);

export const listAdmin = query({
  args: { adminSecret: v.string(), search: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(presetValidator),
  handler: async (ctx, { adminSecret, search, paginationOpts }) => {
    assertAdminApiSecret(adminSecret);
    if (paginationOpts.numItems < 1 || paginationOpts.numItems > 24) throw new Error("Sayfa boyutu 1-24 arasında olmalı.");
    const query = normalizeAttributeLabel(search).slice(0, 200).split(/\s+/).slice(0, 16).join(" ");
    const presets = ctx.db.query("categoryAttributePresets");
    const listing = query
      ? presets.withSearchIndex("search_label", (q) => q.search("normalizedLabel", query))
      : presets.withIndex("by_normalized_label").order("asc");
    return listing.paginate(paginationOpts);
  },
});

export const create = mutation({
  args: {
    adminSecret: v.string(),
    ...templateValidator.fields,
  },
  returns: v.id("categoryAttributePresets"),
  handler: async (ctx, args) => {
    const { adminSecret, ...input } = args;
    assertAdminApiSecret(adminSecret);
    const template = parseAttributeTemplate(input);
    const normalizedLabel = normalizeAttributeLabel(template.label);
    const duplicate = await ctx.db.query("categoryAttributePresets")
      .withIndex("by_normalized_label", (q) => q.eq("normalizedLabel", normalizedLabel))
      .first();
    if (duplicate) throw new Error("Bu özellik kütüphanede zaten kayıtlı.");

    return await ctx.db.insert("categoryAttributePresets", {
      ...template,
      normalizedLabel,
    });
  },
});

/** Templates are copied into categories. Editing never changes existing category fields. */
export const update = mutation({
  args: { adminSecret: v.string(), id: v.id("categoryAttributePresets"), ...templateValidator.fields },
  returns: v.null(),
  handler: async (ctx, { adminSecret, id, ...input }) => {
    assertAdminApiSecret(adminSecret);
    if (!await ctx.db.get(id)) throw new Error("Kayıtlı özellik bulunamadı.");
    const template = parseAttributeTemplate(input);
    const normalizedLabel = normalizeAttributeLabel(template.label);
    const duplicate = await ctx.db.query("categoryAttributePresets")
      .withIndex("by_normalized_label", (q) => q.eq("normalizedLabel", normalizedLabel)).first();
    if (duplicate && duplicate._id !== id) throw new Error("Bu özellik kütüphanede zaten kayıtlı.");
    await ctx.db.patch(id, {
      ...template, normalizedLabel, unit: template.unit, options: template.options,
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    adminSecret: v.string(),
    id: v.id("categoryAttributePresets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertAdminApiSecret(args.adminSecret);
    const preset = await ctx.db.get(args.id);
    if (preset) await ctx.db.delete(args.id);
    return null;
  },
});
