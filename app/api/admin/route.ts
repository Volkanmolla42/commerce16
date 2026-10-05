import { getAdminBackend } from "@/lib/admin/backend";
import { revalidatePath, revalidateTag } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { hasAdminSession, isSameOriginRequest } from "@/lib/admin/session";
import { isRecord, stringValue, parseProductInput, parseCategoryInput, parsePageInput } from "@/lib/admin/input";
import { NextRequest, NextResponse } from "next/server";

function invalidateCatalog(tag: "products" | "categories") {
  revalidateTag(tag, { expire: 0 });
  revalidatePath("/sitemap.xml");
}

function invalidateCms(slugs: string[]) {
  revalidateTag("cms-pages", { expire: 0 });
  revalidatePath("/sitemap.xml");
  for (const slug of new Set(slugs.filter(Boolean))) {
    revalidateTag(`cms-page:${slug}`, { expire: 0 });
    revalidatePath(`/${slug}`);
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "İşlem tamamlanamadı.";
  const unavailable =
    message.includes("ADMIN_API_SECRET") ||
    message.includes("NEXT_PUBLIC_CONVEX_URL") ||
    message.includes("Yönetici işlemi doğrulanamadı");
  const status = unavailable ? 503 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  try {
    const resource = request.nextUrl.searchParams.get("resource");
    const { client, adminSecret } = getAdminBackend();

    if (resource === "categories") {
      const categories = await client.query(api.categories.list, {});
      return NextResponse.json(categories, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "pages") {
      const pages = await client.query(api.pages.list, {});
      return NextResponse.json(pages, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "settings") {
      const settings = await client.query(api.settings.getStoreSettings, {});
      return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
    }

    if (resource === "products") {
      const products = await client.query(api.products.listAllAdmin, { adminSecret });
      return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "orders") {
      const orders = await client.query(api.orders.listAllAdmin, { adminSecret });
      return NextResponse.json(orders, { headers: { "Cache-Control": "no-store" } });
    }
    if (resource === "overview") {
      const [products, categories, orders, pages] = await Promise.all([
        client.query(api.products.listAllAdmin, { adminSecret }),
        client.query(api.categories.list, {}),
        client.query(api.orders.listAllAdmin, { adminSecret }),
        client.query(api.pages.list, {}),
      ]);
      return NextResponse.json(
        { products, categories, orders, pages },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({ error: "Bilinmeyen yönetim alanı." }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "İstek reddedildi." }, { status: 403 });
  }
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.action !== "string") {
      return NextResponse.json({ error: "İşlem bilgisi geçersiz." }, { status: 400 });
    }

    const { client, adminSecret } = getAdminBackend();
    const input = isRecord(body.input) ? body.input : {};

    switch (body.action) {
      case "settings.update": {
        const storeName = stringValue(input.storeName, "Mağaza adı");
        if (storeName.length < 2 || storeName.length > 80) {
          throw new Error("Mağaza adı 2 ile 80 karakter arasında olmalı.");
        }
        const result = await client.mutation(api.settings.updateStoreName, {
          adminSecret,
          storeName,
        });
        revalidateTag("store-settings", { expire: 0 });
        revalidatePath("/", "layout");
        revalidatePath("/opengraph-image");
        return NextResponse.json({ success: true, storeName: result.storeName });
      }
      case "product.image-upload-url": {
        const uploadUrl = await client.mutation(api.products.generateImageUploadUrl, {
          adminSecret,
        });
        return NextResponse.json({ uploadUrl });
      }
      case "product.image-url": {
        const storageId = stringValue(input.storageId, "Görsel kimliği") as Id<"_storage">;
        const url = await client.query(api.products.getImageUrl, { adminSecret, storageId });
        if (!url) throw new Error("Yüklenen görsel bulunamadı.");
        return NextResponse.json({ url });
      }
      case "product.create": {
        const result = await client.mutation(api.products.create, {
          adminSecret, ...parseProductInput(input),
        });
        invalidateCatalog("products");
        return NextResponse.json({ success: true, result });
      }
      case "product.update": {
        const result = await client.mutation(api.products.update, {
          adminSecret,
          id: stringValue(input.id, "Ürün") as Id<"products">,
          ...parseProductInput(input),
        });
        invalidateCatalog("products");
        return NextResponse.json({ success: true, result });
      }
      case "product.delete": {
        const result = await client.mutation(api.products.remove, {
          adminSecret,
          id: stringValue(body.id, "Ürün") as Id<"products">,
        });
        invalidateCatalog("products");
        return NextResponse.json({ success: true, result });
      }
      case "category.create": {
        const result = await client.mutation(api.categories.create, {
          adminSecret, ...parseCategoryInput(input),
        });
        invalidateCatalog("categories");
        return NextResponse.json({ success: true, result });
      }
      case "category.update": {
        const result = await client.mutation(api.categories.update, {
          adminSecret,
          id: stringValue(input.id, "Kategori") as Id<"categories">,
          ...parseCategoryInput(input),
        });
        invalidateCatalog("categories");
        return NextResponse.json({ success: true, result });
      }
      case "category.delete": {
        const result = await client.mutation(api.categories.remove, {
          adminSecret,
          id: stringValue(body.id, "Kategori") as Id<"categories">,
        });
        invalidateCatalog("categories");
        return NextResponse.json({ success: true, result });
      }
      case "page.create": {
        const page = parsePageInput(input);
        const result = await client.mutation(api.pages.create, { adminSecret, ...page });
        invalidateCms([page.slug]);
        return NextResponse.json({ success: true, result });
      }
      case "page.update": {
        const page = parsePageInput(input);
        const previousSlug = stringValue(input.previousSlug, "Mevcut sayfa adresi");
        const result = await client.mutation(api.pages.update, {
          adminSecret, id: stringValue(input.id, "Sayfa") as Id<"pages">, ...page,
        });
        invalidateCms([previousSlug, page.slug]);
        return NextResponse.json({ success: true, result });
      }
      case "page.delete": {
        const slug = stringValue(input.slug, "Sayfa adresi");
        const result = await client.mutation(api.pages.remove, {
          adminSecret,
          id: stringValue(body.id, "Sayfa") as Id<"pages">,
        });
        invalidateCms([slug]);
        return NextResponse.json({ success: true, result });
      }
      case "order.status": {
        const status = input.status;
        if (
          status !== "pending" &&
          status !== "paid" &&
          status !== "shipped" &&
          status !== "delivered" &&
          status !== "cancelled"
        ) {
          throw new Error("Sipariş durumu geçersiz.");
        }
        const result = await client.mutation(api.orders.updateStatus, {
          adminSecret,
          id: stringValue(input.id, "Sipariş") as Id<"orders">,
          status,
        });
        return NextResponse.json({ success: true, result });
      }
      default:
        return NextResponse.json({ error: "Desteklenmeyen işlem." }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
