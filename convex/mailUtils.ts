import { env } from "./_generated/server";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function formatSender(storeName: string, rawFromEmail?: string): string {
  const email = (rawFromEmail || env.ORDER_FROM_EMAIL || "onboarding@resend.dev").trim();
  if (email.includes("<")) return email;
  return `${storeName.trim() || "Mağaza"} <${email}>`;
}

export type EmailTemplateKey =
  | "payment_confirmation"
  | "order_shipped"
  | "order_cancelled"
  | "order_delivered"
  | "admin_new_order"
  | "restock_notification"
  | "abandoned_cart_recovery"
  | "low_stock_alert"
  | "contact_form_alert"
  | "password_reset_otp"
  | "welcome_email";

export interface SendResendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  idempotencyKey?: string;
  apiKey?: string;
}

export interface SendResendEmailResult {
  ok: boolean;
  status: number;
  messageId?: string;
  error?: string;
}

/**
 * Resend REST API üzerinden merkezi e-posta gönderimi.
 * Geliştirme/sandbox 403 kısıtlamalarını otomatik yönetir.
 */
export async function sendResendEmail(options: SendResendEmailOptions): Promise<SendResendEmailResult> {
  const apiKey = (options.apiKey || env.RESEND_API_KEY)?.trim();
  const fromEmail = (options.from || env.ORDER_FROM_EMAIL || "onboarding@resend.dev").trim();

  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      error: "RESEND_API_KEY ortam değişkeni yapılandırılmamış.",
    };
  }

  const sendOnce = async (recipient: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }

    return await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject: options.subject,
        html: options.html,
        text: options.text,
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  };

  try {
    let response = await sendOnce(options.to);

    // Resend sandbox 403 kontrolü ve fallback
    if (!response.ok && response.status === 403) {
      const errText = await response.text();
      if (errText.includes("mollavolkan11@gmail.com")) {
        console.warn(`[Resend Sandbox Fallback] ${options.to} yerine mollavolkan11@gmail.com adresine yönlendiriliyor.`);
        response = await sendOnce("mollavolkan11@gmail.com");
      } else {
        return {
          ok: false,
          status: response.status,
          error: `Resend 403: ${errText}`,
        };
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        ok: false,
        status: response.status,
        error: `Resend (${response.status}): ${errorBody}`,
      };
    }

    const data = await response.json().catch(() => null);
    return {
      ok: true,
      status: response.status,
      messageId: data?.id,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 500,
      error: `Bağlantı hatası: ${message}`,
    };
  }
}
