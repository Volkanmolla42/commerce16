type Profile = { name?: string; email?: string; phone?: string };
type Address = {
  _id: string;
  isDefault: boolean;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  addressLine1: string;
  addressLine2?: string;
};

export type CheckoutDraft = Partial<Record<
  "customerName" | "customerEmail" | "phone" | "city" | "district" | "addressLine",
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

  return {
    selectedAddressId: selectedAddress?._id ?? "custom",
    customerName: draft.customerName ?? selectedAddress?.fullName ?? profile?.name ?? "",
    customerEmail: draft.customerEmail ?? profile?.email ?? "",
    phone: draft.phone ?? selectedAddress?.phone ?? profile?.phone ?? "",
    city: draft.city ?? selectedAddress?.city ?? "",
    district: draft.district ?? selectedAddress?.district ?? "",
    addressLine: draft.addressLine ?? (selectedAddress
      ? [selectedAddress.addressLine1, selectedAddress.addressLine2].filter(Boolean).join(", ")
      : ""),
  };
}
