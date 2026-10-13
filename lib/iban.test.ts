import { describe, expect, it } from "vitest";
import { cleanIban, formatIban } from "./iban";

describe("iban utils", () => {
  it("cleans iban input", () => {
    expect(cleanIban("  tr12   0006   4000  ")).toBe("TR12 0006 4000");
    expect(cleanIban("")).toBe("");
    expect(cleanIban(null)).toBe("");
  });

  it("formats iban in blocks of 4", () => {
    expect(formatIban("TR120006400000000000000001")).toBe("TR12 0006 4000 0000 0000 0000 01");
    expect(formatIban("")).toBe("");
    expect(formatIban(null)).toBe("");
  });
});
