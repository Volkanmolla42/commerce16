import { NextResponse, type NextRequest } from "next/server";
import { getServerAdminBasePath } from "@/lib/admin/routes";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminBasePath = getServerAdminBasePath();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }

  if (pathname === adminBasePath || pathname.startsWith(`${adminBasePath}/`)) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/admin${pathname.slice(adminBasePath.length)}`;
    return NextResponse.rewrite(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
