import { describe, expect, it } from "vitest";
import { getAdminErrorMessage } from "./backend";

describe("getAdminErrorMessage", () => {
  it("cleans Convex Request ID and Uncaught Error prefixes", () => {
    const raw = new Error(
      "[Request ID: dc3f337bee996b14] Server Error Uncaught Error: Havale / EFT açıkken açıklama ve en az bir banka hesabı zorunludur.\n  at handler (convex/payments.ts:130:11)"
    );
    expect(getAdminErrorMessage(raw)).toBe(
      "Havale / EFT açıkken açıklama ve en az bir banka hesabı zorunludur."
    );
  });

  it("cleans standard error without prefixes", () => {
    expect(getAdminErrorMessage(new Error("Basit hata mesajı"))).toBe("Basit hata mesajı");
  });

  it("handles non-Error objects with fallback", () => {
    expect(getAdminErrorMessage(null)).toBe("İşlem tamamlanamadı.");
    expect(getAdminErrorMessage(undefined)).toBe("İşlem tamamlanamadı.");
  });
});
