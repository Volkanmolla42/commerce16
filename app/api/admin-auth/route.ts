import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const ADMIN_PIN = process.env.ADMIN_PIN || "147258";
const COOKIE_NAME = "commerce_admin_session";

function getExpectedToken() {
  return crypto
    .createHash("sha256")
    .update(`admin-salt-${ADMIN_PIN}`)
    .digest("hex");
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token && token === getExpectedToken()) {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false });
}

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();

    if (!pin || pin.trim() !== ADMIN_PIN.trim()) {
      return NextResponse.json(
        { success: false, error: "Hatalı 6 haneli yönetici parolası!" },
        { status: 401 }
      );
    }

    const token = getExpectedToken();
    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 gün
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Sunucu hatası oluştu" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ success: true });
}
