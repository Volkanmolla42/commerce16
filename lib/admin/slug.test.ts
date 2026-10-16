import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("converts Turkish characters to latin equivalents", () => {
    expect(slugify("Şık ve Zarif Altın Kolye")).toBe("sik-ve-zarif-altin-kolye");
    expect(slugify("Çelik Küpe & Yüzük Çeşitleri")).toBe("celik-kupe-yuzuk-cesitleri");
    expect(slugify("Özel Işıltılı Gümüş")).toBe("ozel-isiltili-gumus");
  });

  it("handles leading, trailing, and multiple hyphens", () => {
    expect(slugify("---Harika Ürün---")).toBe("harika-urun");
    expect(slugify("Ürün   ile   İlgili")).toBe("urun-ile-ilgili");
  });

  it("removes non-alphanumeric characters", () => {
    expect(slugify("Kolye (14 Ayar) #1!")).toBe("kolye-14-ayar-1");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});
