export const DEFAULT_PAYMENT_DESCRIPTIONS = {
  paytr: "Kart bilgileriniz mağazamızda saklanmaz.",
  cashOnDelivery: "Siparişinizi kapıda teslim alırken nakit veya banka kartı ile ödeyebilirsiniz.",
  bankTransfer: "Siparişi oluşturduktan sonra belirtilen banka hesabına sipariş numaranızı açıklama kısmına yazarak ödeme yapınız.",
} as const;

export type PaymentMethodKey = keyof typeof DEFAULT_PAYMENT_DESCRIPTIONS;
