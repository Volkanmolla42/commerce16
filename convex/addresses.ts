import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { getDistrictById, getDistrictByName, getProvinceById, getProvinceByName } from "../lib/turkey-provinces";

const addressValidator = schema.doc("addresses");
const addressInputValidator = addressValidator.omit("_id", "_creationTime", "userId");
export type AddressInput = Infer<typeof addressInputValidator>;
const MAX_ADDRESSES = 100;

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Giriş yapmanız gerekmektedir.");
  return userId;
}

async function ownedAddress(ctx: MutationCtx, addressId: Id<"addresses">) {
  const userId = await requireUser(ctx);
  const address = await ctx.db.get(addressId);
  if (!address || address.userId !== userId) throw new Error("Adres bulunamadı veya yetkiniz yok.");
  return address;
}

async function userAddresses(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db.query("addresses").withIndex("by_userId", (q) => q.eq("userId", userId)).take(MAX_ADDRESSES + 1);
}

function normalizeAddress(input: AddressInput): AddressInput {
  const province = getProvinceById(input.provinceId) ?? getProvinceByName(input.city);
  const district = province && (
    getDistrictById(province.id, input.districtId) ?? getDistrictByName(province.id, input.district)
  );
  if (!province || !district) throw new Error("Türkiye il ve ilçe listesinden geçerli bir adres seçin.");
  return {
    ...input,
    title: input.title.trim() || "Ev",
    fullName: input.fullName.trim(), phone: input.phone.trim(), city: province.name,
    district: district.name, provinceId: province.id, districtId: district.id,
    addressLine1: input.addressLine1.trim(),
  };
}

export async function insertAddress(ctx: MutationCtx, userId: Id<"users">, input: AddressInput) {
  const existing = await userAddresses(ctx, userId);
  if (existing.length >= MAX_ADDRESSES) throw new Error("En fazla 100 adres kaydedebilirsiniz.");
  const isDefault = input.isDefault || existing.length === 0 || !existing.some((address) => address.isDefault);
  if (isDefault) {
    for (const address of existing) if (address.isDefault) await ctx.db.patch(address._id, { isDefault: false });
  }
  return await ctx.db.insert("addresses", { userId, ...normalizeAddress(input), isDefault });
}

async function selectDefault(ctx: MutationCtx, userId: Id<"users">, addressId: Id<"addresses">) {
  for (const address of await userAddresses(ctx, userId)) {
    const isDefault = address._id === addressId;
    if (address.isDefault !== isDefault) await ctx.db.patch(address._id, { isDefault });
  }
}

export const getMyAddresses = query({
  args: {}, returns: v.array(addressValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const addresses = await userAddresses(ctx, userId);
    return addresses.slice(0, MAX_ADDRESSES).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  },
});
export const addAddress = mutation({
  args: addressInputValidator.fields, returns: v.id("addresses"),
  handler: async (ctx, args) => insertAddress(ctx, await requireUser(ctx), args),
});
export const updateAddress = mutation({
  args: { addressId: v.id("addresses"), ...addressInputValidator.fields }, returns: v.null(),
  handler: async (ctx, { addressId, ...input }) => {
    const address = await ownedAddress(ctx, addressId);
    if (input.isDefault) await selectDefault(ctx, address.userId, addressId);
    await ctx.db.patch(addressId, normalizeAddress(input));
    if (!input.isDefault && address.isDefault) {
      const remaining = await userAddresses(ctx, address.userId);
      const replacement = remaining.find((item) => item._id !== addressId) ?? remaining[0];
      if (replacement) await selectDefault(ctx, address.userId, replacement._id);
    }
    return null;
  },
});
export const deleteAddress = mutation({
  args: { addressId: v.id("addresses") }, returns: v.null(),
  handler: async (ctx, args) => {
    const address = await ownedAddress(ctx, args.addressId);
    await ctx.db.delete(args.addressId);
    if (address.isDefault) {
      const remaining = await ctx.db.query("addresses").withIndex("by_userId", (q) => q.eq("userId", address.userId)).first();
      if (remaining) await selectDefault(ctx, address.userId, remaining._id);
    }
    return null;
  },
});
export const setDefaultAddress = mutation({
  args: { addressId: v.id("addresses") }, returns: v.null(),
  handler: async (ctx, args) => {
    const address = await ownedAddress(ctx, args.addressId);
    await selectDefault(ctx, address.userId, address._id);
    return null;
  },
});
