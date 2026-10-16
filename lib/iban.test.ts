import { describe, expect, it } from "vitest";
import { formatIban } from "./iban";

describe("formatIban", () => {
  it("formats full 26-char IBAN in blocks of 4", () => {
    expect(formatIban("TR118187888888888888888877")).toBe("TR11 8187 8888 8888 8888 8888 77");
    expect(formatIban("TR11 8187 8888 8888 8888 8888 77")).toBe("TR11 8187 8888 8888 8888 8888 77");
  });

  it("adds TR prefix when digits are entered without it", () => {
    expect(formatIban("118187888888888888888877")).toBe("TR11 8187 8888 8888 8888 8888 77");
  });

  it("handles lowercase and trims extra spaces/symbols", () => {
    expect(formatIban("tr11 8187-8888")).toBe("TR11 8187 8888");
  });

  it("handles partial input gracefully", () => {
    expect(formatIban("TR")).toBe("TR");
    expect(formatIban("TR1")).toBe("TR1");
    expect(formatIban("TR118")).toBe("TR11 8");
  });

  it("caps at standard 26 chars (TR + 24 digits)", () => {
    expect(formatIban("TR1181878888888888888888779999")).toBe("TR11 8187 8888 8888 8888 8888 77");
  });

  it("handles empty or null values", () => {
    expect(formatIban("")).toBe("");
    expect(formatIban(null)).toBe("");
    expect(formatIban(undefined)).toBe("");
  });
});
