import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("generates CSV with UTF-8 BOM and semicolon delimiters", () => {
    const headers = ["ID", "Ürün Adı", "Fiyat"];
    const rows = [
      ["1", "Gümüş Kolye", 150],
      ["2", "Altın Yüzük", 500],
    ];

    const result = toCsv(headers, rows);
    expect(result.startsWith("\uFEFF")).toBe(true);
    expect(result).toContain("ID;Ürün Adı;Fiyat\r\n");
    expect(result).toContain("1;Gümüş Kolye;150\r\n");
    expect(result).toContain("2;Altın Yüzük;500");
  });

  it("escapes quotes and delimiters within cells", () => {
    const headers = ["Açıklama"];
    const rows = [[`"Özel" Tasarım; 14 Ayar`]];

    const result = toCsv(headers, rows);
    expect(result).toContain(`"""Özel"" Tasarım; 14 Ayar"`);
  });

  it("neutralizes CSV formula injection characters (=, +, -, @)", () => {
    const headers = ["Girdi"];
    const rows = [["=SUM(A1:A10)"], ["+cmd.exe"], ["-5"], ["@test"]];

    const result = toCsv(headers, rows);
    expect(result).toContain("'=SUM(A1:A10)");
    expect(result).toContain("'+cmd.exe");
    expect(result).toContain("'-5");
    expect(result).toContain("'@test");
  });
});
