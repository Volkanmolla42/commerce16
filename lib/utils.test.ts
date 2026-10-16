import { describe, expect, it } from "vitest";
import { resolveBaseUrl } from "./utils";

describe("resolveBaseUrl", () => {
  it("hiç adres tanımlı değilse lokal geliştirme adresine düşer", () => {
    expect(resolveBaseUrl({})).toBe("http://localhost:3000");
  });

  it("Vercel'in otomatik verdiği üretim domain'ini kullanır", () => {
    expect(resolveBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "commerce16.vercel.app" })).toBe(
      "https://commerce16.vercel.app"
    );
  });

  it("elle tanımlanan adres Vercel domain'ini ezer", () => {
    expect(
      resolveBaseUrl({
        SITE_URL: "https://takicim.com/",
        VERCEL_PROJECT_PRODUCTION_URL: "commerce16.vercel.app",
      })
    ).toBe("https://takicim.com");
  });

  it("NEXT_PUBLIC_SITE_URL her zaman önce gelir", () => {
    expect(
      resolveBaseUrl({
        NEXT_PUBLIC_SITE_URL: "https://onceki-adres.com",
        SITE_URL: "https://ikinci-adres.com",
      })
    ).toBe("https://onceki-adres.com");
  });

  it("şemasız adresi https'ye çevirir", () => {
    expect(resolveBaseUrl({ SITE_URL: "takicim.com" })).toBe("https://takicim.com");
  });
});
