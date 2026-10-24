export type CouponPreview = {
  valid: boolean;
  code?: string;
  message?: string;
  discountKurus?: number;
} | null | undefined;

export type SavedAddress = {
  _id: string;
  title: string;
  city: string;
  district: string;
  provinceId: string;
  districtId: string;
  addressLine1: string;
};

export type PaymentSettings = {
  paytr: {
    enabled: boolean;
    description: string;
  };
  bankTransfer: {
    enabled: boolean;
    description: string;
    accounts: { id: string; bankName: string; accountHolder: string; iban: string }[];
  };
  cashOnDelivery: {
    enabled: boolean;
    description: string;
    fee: number;
  };
};

export type PaymentMethod = "bank_transfer" | "cash_on_delivery";
