import { describe, expect, it } from "vitest";
import {
  formatOrderCode,
  getOrderCode,
  getOrderPaymentMethodTitle,
  formatWhatsAppUrl,
  formatPhone,
  resolveCarrierTrackingUrl,
  getOrderPriceBreakdown,
} from "./orders";

describe("orders utils", () => {
  it("formats order code from id", () => {
    expect(formatOrderCode("k173bz57rxj0yvctqastg4az258g7tby")).toBe("258G7TBY");
    expect(formatOrderCode("k173bz57rxj0yvctqastg4az258g7tby", true)).toBe("#258G7TBY");
  });

  it("handles null, undefined and empty strings", () => {
    expect(formatOrderCode(null)).toBe("");
    expect(formatOrderCode(undefined)).toBe("");
    expect(formatOrderCode("")).toBe("");
    expect(getOrderCode(null)).toBe("");
    expect(getOrderCode(undefined)).toBe("");
  });

  it("handles order object with and without orderNumber", () => {
    expect(getOrderCode({ _id: "k173bz57rxj0yvctqastg4az258g7tby" })).toBe("258G7TBY");
    expect(getOrderCode({ _id: "k173bz57rxj0yvctqastg4az258g7tby" }, true)).toBe("#258G7TBY");
    expect(getOrderCode({ _id: "id123", orderNumber: "ORD-999" })).toBe("ORD-999");
    expect(getOrderCode({ _id: "id123", orderNumber: "ORD-999" }, true)).toBe("#ORD-999");
  });

  it("resolves order payment method titles correctly", () => {
    expect(getOrderPaymentMethodTitle({ paymentMethod: "paytr" })).toBe("PayTR (Demo)");
    expect(getOrderPaymentMethodTitle({ paymentMethod: "bank_transfer" })).toBe("Havale / EFT");
    expect(getOrderPaymentMethodTitle({ paymentMethod: "cash_on_delivery" })).toBe("Kapıda Ödeme");
    expect(getOrderPaymentMethodTitle({ paymentMethod: "unknown" })).toBe("Standart");
    expect(getOrderPaymentMethodTitle({ paymentMethod: "paytr", paymentMethodTitle: "Özel Kart" })).toBe("Özel Kart");
    expect(getOrderPaymentMethodTitle(null, "Bilinmeyen")).toBe("Bilinmeyen");
  });

  it("generates WhatsApp urls correctly", () => {
    expect(formatWhatsAppUrl("0555 123 45 67")).toBe("https://wa.me/905551234567");
    expect(formatWhatsAppUrl("905551234567")).toBe("https://wa.me/905551234567");
    expect(formatWhatsAppUrl("5551234567")).toBe("https://wa.me/905551234567");
    expect(formatWhatsAppUrl(null)).toBeNull();
    expect(formatWhatsAppUrl("")).toBeNull();
  });

  it("formats phone numbers correctly", () => {
    expect(formatPhone("05551234567")).toBe("0 (555) 123 45 67");
    expect(formatPhone("5551234567")).toBe("0 (555) 123 45 67");
    expect(formatPhone("905551234567")).toBe("+90 (555) 123 45 67");
    expect(formatPhone("+90 555 123 45 67")).toBe("+90 (555) 123 45 67");
    expect(formatPhone("123")).toBe("123");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });

  it("resolves carrier tracking urls correctly", () => {
    expect(resolveCarrierTrackingUrl("Yurtiçi Kargo", "123456")).toContain("yurticikargo.com");
    expect(resolveCarrierTrackingUrl("Aras Kargo", "123456")).toContain("araskargo.com.tr");
    expect(resolveCarrierTrackingUrl("MNG Kargo", "123456")).toContain("mngkargo.com.tr");
    expect(resolveCarrierTrackingUrl("Trendyol Express", "123456")).toContain("trendyol.com");
    expect(resolveCarrierTrackingUrl("Bilinmeyen", "123456")).toBeNull();
    expect(resolveCarrierTrackingUrl("Aras Kargo", null)).toBeNull();
  });

  describe("getOrderPriceBreakdown", () => {
    it("handles order with paid shipping fee", () => {
      const breakdown = getOrderPriceBreakdown({
        total: "1008.00",
        items: [{ price: "888", quantity: 1 }],
        shippingFee: 120,
      });

      expect(breakdown.itemsSubtotal).toBe(888);
      expect(breakdown.shippingFee).toBe(120);
      expect(breakdown.isFreeShipping).toBe(false);
      expect(breakdown.total).toBe(1008);
      expect(breakdown.paymentFee).toBe(0);
      expect(breakdown.couponDiscount).toBe(0);
    });

    it("handles order with free shipping", () => {
      const breakdown = getOrderPriceBreakdown({
        total: "1500.00",
        items: [{ price: "750", quantity: 2 }],
        shippingFee: 0,
      });

      expect(breakdown.itemsSubtotal).toBe(1500);
      expect(breakdown.shippingFee).toBe(0);
      expect(breakdown.isFreeShipping).toBe(true);
      expect(breakdown.total).toBe(1500);
    });

    it("defaults shippingFee to 0 when not provided", () => {
      const breakdown = getOrderPriceBreakdown({
        total: "888.00",
        items: [{ price: "888", quantity: 1 }],
      });

      expect(breakdown.itemsSubtotal).toBe(888);
      expect(breakdown.shippingFee).toBe(0);
      expect(breakdown.isFreeShipping).toBe(true);
      expect(breakdown.total).toBe(888);
    });

    it("handles order with coupon and payment fee correctly", () => {
      const breakdown = getOrderPriceBreakdown({
        total: "958.00",
        items: [{ price: "888", quantity: 1 }],
        couponDiscountKurus: 10000, // 100 TL
        paymentFee: 50,
        shippingFee: 120,
      });

      expect(breakdown.itemsSubtotal).toBe(888);
      expect(breakdown.couponDiscount).toBe(100);
      expect(breakdown.paymentFee).toBe(50);
      expect(breakdown.shippingFee).toBe(120);
      expect(breakdown.total).toBe(958);
    });

    it("handles null or empty order gracefully", () => {
      const breakdown = getOrderPriceBreakdown(null);
      expect(breakdown.itemsSubtotal).toBe(0);
      expect(breakdown.shippingFee).toBe(0);
      expect(breakdown.isFreeShipping).toBe(true);
      expect(breakdown.total).toBe(0);
    });
  });
});
