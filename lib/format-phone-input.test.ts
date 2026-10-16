import { describe, expect, it } from "vitest";
import { formatPhoneInput } from "./format-phone-input";

describe("formatPhoneInput", () => {
  it("formats 10-digit national number with 0 prefix and spaces", () => {
    expect(formatPhoneInput("5551234567")).toBe("0555 123 45 67");
  });

  it("handles leading 0 gracefully", () => {
    expect(formatPhoneInput("05551234567")).toBe("0555 123 45 67");
  });

  it("converts +90 country code prefix", () => {
    expect(formatPhoneInput("+905551234567")).toBe("0555 123 45 67");
    expect(formatPhoneInput("905551234567")).toBe("0555 123 45 67");
  });

  it("formats partial phone numbers as user types", () => {
    expect(formatPhoneInput("555")).toBe("0555");
    expect(formatPhoneInput("555123")).toBe("0555 123");
    expect(formatPhoneInput("55512345")).toBe("0555 123 45");
  });

  it("caps input at standard length", () => {
    expect(formatPhoneInput("055512345678999")).toBe("0555 123 45 67");
  });

  it("returns empty string on empty or non-digit input", () => {
    expect(formatPhoneInput("")).toBe("");
    expect(formatPhoneInput("abc")).toBe("");
  });
});
