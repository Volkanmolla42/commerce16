import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format-date";

describe("format-date utils", () => {
  const timestamp = new Date("2026-10-13T09:30:00Z").getTime();

  it("formats date correctly", () => {
    const formatted = formatDate(timestamp);
    expect(formatted).toContain("2026");
    expect(formatted).toContain("Eki");
  });

  it("formats date and time correctly", () => {
    const formatted = formatDateTime(timestamp);
    expect(formatted).toContain("2026");
    expect(formatted).toContain(":");
  });

  it("handles null and invalid inputs gracefully", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("invalid-date")).toBe("—");
    expect(formatDateTime(null, undefined, "Belirtilmedi")).toBe("Belirtilmedi");
  });
});
