import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_BASE_PATH } from "@/lib/admin/routes";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.rewrite(new URL("/_not-found", request.url));
  }

  if (pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/admin${pathname.slice(ADMIN_BASE_PATH.length)}`;
    return NextResponse.rewrite(destination);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
