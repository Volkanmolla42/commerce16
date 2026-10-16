import { ADMIN_BASE_PATH } from "@/lib/admin/routes";
import { baseUrl } from "@/lib/utils";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // Yönetici paneli /admin altında yaşar ama ziyaretçiye ADMIN_PATH ile görünür.
        disallow: ["/admin", "/admin/*", ADMIN_BASE_PATH, `${ADMIN_BASE_PATH}/*`, "/api/*"],
      },
    ],
    sitemap: new URL("/sitemap.xml", baseUrl).toString(),
  };
}
