import { describe, expect, it } from "vitest";
import { getLegalDocuments, type SellerInfo } from "./legal-documents";

const seller: SellerInfo = {
  storeName: "Merve Kuyumculuk",
  address: "İstasyon Cad. No: 5/3 İstanbul",
  email: "satici@ornek.test",
  phone: "02121112233",
};

describe("legal documents", () => {
  it("her iki belgede satıcı kimliğini gösterir", () => {
    const documents = getLegalDocuments(seller);
    for (const body of [documents.distanceSalesAgreement.body, documents.preInformationForm.body]) {
      expect(body).toContain("Merve Kuyumculuk");
      expect(body).toContain(seller.address);
      expect(body).toContain(seller.email);
      expect(body).toContain(seller.phone);
    }
  });

  it("placeholder metinleri bırakmaz", () => {
    const documents = getLegalDocuments(seller);
    expect(documents.distanceSalesAgreement.body).not.toContain("Mağaza İşletmesi");
    expect(documents.preInformationForm.body).not.toContain("Müşteri hizmetleri destek hattı");
  });

  it("satıcı bilgisi eksikse belgeyi hazırlanmamış sayar", () => {
    for (const field of Object.keys(seller) as (keyof SellerInfo)[]) {
      const documents = getLegalDocuments({ ...seller, [field]: "  " });
      expect(documents.distanceSalesAgreement.ready, field).toBe(false);
      expect(documents.preInformationForm.ready, field).toBe(false);
    }
    expect(getLegalDocuments(seller).distanceSalesAgreement.ready).toBe(true);
  });

  it("satıcı değişirse belge sürümü de değişir", () => {
    const before = getLegalDocuments(seller).distanceSalesAgreement.version;
    const after = getLegalDocuments({ ...seller, address: "Kadıköy / İstanbul" }).distanceSalesAgreement.version;
    expect(after).not.toBe(before);
  });

  it("alanlardaki işaretleme karakterlerini kaçırır", () => {
    const body = getLegalDocuments({ ...seller, storeName: "<script>A & B</script>" }).distanceSalesAgreement.body;
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
    expect(body).toContain("A &amp; B");
  });
});
