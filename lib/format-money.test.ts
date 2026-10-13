import { describe, expect, it } from "vitest";
import { formatMoney, kurusToLira, toKurus } from "./format-money";

describe("format-money utils", () => {
  it("formats currency correctly", () => {
    expect(formatMoney(100)).toContain("100");
    expect(formatMoney("250.50")).toContain("250");
  });

  it("converts kurus to lira", () => {
    expect(kurusToLira(10000)).toBe("100.00");
    expect(kurusToLira(1550)).toBe("15.50");
    expect(kurusToLira(0)).toBe("0.00");
    expect(kurusToLira(null)).toBe("0.00");
    expect(kurusToLira(undefined)).toBe("0.00");
  });

  it("converts lira to kurus", () => {
    expect(toKurus("100.00")).toBe(10000);
    expect(toKurus("15,50")).toBe(1550);
    expect(toKurus(15.5)).toBe(1550);
    expect(toKurus("")).toBe(0);
    expect(toKurus(null)).toBe(0);
    expect(toKurus("invalid")).toBe(0);
  });
});
