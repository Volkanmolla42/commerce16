export const distanceSalesAgreement = {
  title: "Mesafeli Satış Sözleşmesi",
  slug: "distance-sales-agreement",
  body: "<p><strong>Yayınlamadan önce:</strong> Köşeli parantezli alanları işletmenin gerçek bilgileri ve satış koşullarıyla doldurun. Bu taslak hukuki danışmanlık yerine geçmez.</p><h2>Satıcı bilgileri</h2><p>[Ticaret unvanı, MERSİS numarası, vergi dairesi ve numarası, açık adres, telefon ve e-posta]</p><h2>Alıcı ve sipariş</h2><p>Alıcı bilgileri ve siparişe ait ürün, adet, vergiler dâhil toplam bedel ile teslimat bilgileri sipariş özeti ve ön bilgilendirme formunda yer alır.</p><h2>Teslimat ve ödeme</h2><p>[Teslimat süresi, taşıyıcı, teslimat masrafları ve ödeme koşulları]</p><h2>Cayma hakkı ve iade</h2><p>[Cayma hakkının süresi, kullanım yöntemi, iade adresi, iade masrafları ve mevzuattaki istisnalar]</p><h2>Uyuşmazlık ve başvuru</h2><p>[Tüketici hakem heyeti / tüketici mahkemesi ve başvuru bilgileri]</p>",
};

export const preInformationForm = {
  title: "Ön Bilgilendirme Formu",
  slug: "pre-information-form",
  body: "<p><strong>Yayınlamadan önce:</strong> Köşeli parantezli alanları işletmenin gerçek bilgileri ve satış koşullarıyla doldurun. Siparişe özel ürün, fiyat ve teslimat bilgileri ödeme öncesinde ayrıca gösterilir.</p><h2>Satıcı bilgileri</h2><p>[Ticaret unvanı, MERSİS numarası, vergi dairesi ve numarası, açık adres, telefon ve e-posta]</p><h2>Ürün ve toplam bedel</h2><p>Ürünlerin temel nitelikleri, adetleri, vergiler dâhil fiyatları, varsa ek masraflar, kargo ve sipariş toplamı ödeme öncesi sipariş özetinde gösterilir.</p><h2>Teslimat</h2><p>[Teslimat yöntemi, taşıyıcı ve öngörülen teslimat süresi]</p><h2>Cayma hakkı ve şikâyet</h2><p>[Cayma hakkı, kullanımı, istisnalar, iade yöntemi ve tüketici başvuru yolları]</p>",
};

function versionOf(title: string, body: string) {
  const source = `${title}\n${body}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

function checkoutDocument(document: { title: string; slug: string; body: string }) {
  return {
    ...document,
    version: versionOf(document.title, document.body),
    ready: document.body.trim().length >= 100 && !/\[[^\]]+\]/.test(document.body),
  };
}

export function getCheckoutLegalDocuments() {
  return {
    distanceSalesAgreement: checkoutDocument(distanceSalesAgreement),
    preInformationForm: checkoutDocument(preInformationForm),
  };
}
