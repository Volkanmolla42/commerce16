import { getDistrictByName, getProvinceByName } from "@/lib/turkey-provinces";

type Profile = { name?: string; email?: string; phone?: string };
type Address = {
  _id: string;
  isDefault: boolean;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  provinceId?: string;
  districtId?: string;
  addressLine1: string;
};

export type CheckoutDraft = Partial<Record<
  "customerName" | "customerEmail" | "phone" | "city" | "district" | "addressLine" | "provinceId" | "districtId",
  string
>>;

// Keep server defaults reactive while preserving every explicit edit, including empty values.
export function getCheckoutDetails({ profile, addresses, selection, draft }: {
  profile: Profile | null | undefined;
  addresses: Address[] | undefined;
  selection: string | null;
  draft: CheckoutDraft;
}) {
  const selectedAddress = selection === null
    ? addresses?.find((address) => address.isDefault) ?? addresses?.[0]
    : addresses?.find((address) => address._id === selection);
  const cityName = draft.city ?? selectedAddress?.city ?? "";
  const districtName = draft.district ?? selectedAddress?.district ?? "";
  const provinceId = draft.provinceId ?? selectedAddress?.provinceId ?? getProvinceByName(cityName)?.id ?? "";
  const districtId = draft.districtId ?? selectedAddress?.districtId ?? getDistrictByName(provinceId, districtName)?.id ?? "";

  return {
    selectedAddressId: selectedAddress?._id ?? "custom",
    customerName: draft.customerName ?? selectedAddress?.fullName ?? profile?.name ?? "",
    customerEmail: draft.customerEmail ?? profile?.email ?? "",
    phone: draft.phone ?? selectedAddress?.phone ?? profile?.phone ?? "",
    provinceId,
    districtId,
    city: cityName,
    district: districtName,
    addressLine: draft.addressLine ?? (selectedAddress?.addressLine1 ?? ""),
  };
}
