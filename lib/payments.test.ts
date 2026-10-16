import { describe, expect, it } from "vitest";
import { DEFAULT_PAYMENT_DESCRIPTIONS } from "./payments";

describe("DEFAULT_PAYMENT_DESCRIPTIONS", () => {
  it("provides non-empty default descriptions for all payment methods", () => {
    expect(DEFAULT_PAYMENT_DESCRIPTIONS.paytr).toBe("Kart bilgileriniz mağazamızda saklanmaz.");
    expect(DEFAULT_PAYMENT_DESCRIPTIONS.cashOnDelivery).toBe(
      "Siparişinizi kapıda teslim alırken nakit veya banka kartı ile ödeyebilirsiniz."
    );
    expect(DEFAULT_PAYMENT_DESCRIPTIONS.bankTransfer).toBe(
      "Siparişi oluşturduktan sonra belirtilen banka hesabına sipariş numaranızı açıklama kısmına yazarak ödeme yapınız."
    );
  });
});
