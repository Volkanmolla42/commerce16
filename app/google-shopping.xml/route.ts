import { routes } from "@/lib/storefront-routes";
import { getGoogleShoppingProducts } from "@/lib/catalog";
import { formatMoney } from "@/lib/format-money";
import { storeConfig } from "@/lib/store-config";
import { baseUrl } from "@/lib/utils";

function cleanCdata(text: string): string {
  return text.replace(/]]>/g, "]]]]><![CDATA[>");
}

function formatGooglePrice(priceStr: string): string {
  const num = Number(priceStr);
  const formatted = Number.isFinite(num) ? num.toFixed(2) : "0.00";
  return `${formatted} TRY`;
}

function getProductDescription(title: string, price: string, attributes?: { key: string; value: string | number | boolean | string[] }[]): string {
  const parts = [`${title} ürününü ${formatMoney(price)} fiyatıyla inceleyin ve güvenle satın alın.`];
  if (attributes && attributes.length > 0) {
    const attrTexts = attributes
      .map((attr) => `${attr.key}: ${Array.isArray(attr.value) ? attr.value.join(", ") : String(attr.value)}`)
      .slice(0, 5);
    parts.push(attrTexts.join(" | "));
  }
  return parts.join(" ");
}

export async function GET() {
  const products = await getGoogleShoppingProducts();

  const storeName = storeConfig.name;
  const storeUrl = baseUrl;

  const itemsXml = products.map((product) => {
    const productUrl = new URL(routes.product(product.slug), baseUrl).toString();
    const images = product.images.map((img) => img.url).filter(Boolean);
    const mainImage = images[0] || "";
    const additionalImages = images.slice(1, 10);
    const description = getProductDescription(product.title, product.price, product.attributes);

    // Identify GTIN or MPN from variants
    const firstVariant = product.variants?.[0];
    const barcode = product.variants?.find((v) => v.barcode)?.barcode || firstVariant?.barcode;
    const sku = product.variants?.find((v) => v.sku)?.sku || firstVariant?.sku;
    const hasIdentifier = Boolean(barcode || sku);

    const additionalImageTags = additionalImages
      .map((url) => `      <g:additional_image_link>${url}</g:additional_image_link>`)
      .join("\n");

    return `    <item>
      <g:id>${product.id}</g:id>
      <g:title><![CDATA[${cleanCdata(product.title)}]]></g:title>
      <g:description><![CDATA[${cleanCdata(description)}]]></g:description>
      <g:link>${productUrl}</g:link>
${mainImage ? `      <g:image_link>${mainImage}</g:image_link>\n` : ""}${additionalImageTags ? `${additionalImageTags}\n` : ""}      <g:availability>${product.availableForSale ? "in_stock" : "out_of_stock"}</g:availability>
      <g:price>${formatGooglePrice(product.price)}</g:price>
      <g:condition>new</g:condition>
      <g:brand><![CDATA[${cleanCdata(storeName)}]]></g:brand>
${product.categorySlug ? `      <g:product_type><![CDATA[${cleanCdata(product.categorySlug)}]]></g:product_type>\n` : ""}      <g:identifier_exists>${hasIdentifier ? "yes" : "no"}</g:identifier_exists>
${barcode ? `      <g:gtin>${barcode}</g:gtin>\n` : ""}${sku ? `      <g:mpn>${sku}</g:mpn>\n` : ""}    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title><![CDATA[${cleanCdata(storeName)}]]></title>
    <link>${storeUrl}</link>
    <description><![CDATA[${cleanCdata(storeConfig.description)}]]></description>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
