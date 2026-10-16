import { env } from "../_generated/server";

export interface SendRequest {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  messageId?: string;
  error?: string;
}

/** Sağlayıcı taşıması: yalnızca HTTP çağrısı, iş mantığı ve kayıt yok. */
export async function sendViaResend(request: SendRequest): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, status: 0, error: "RESEND_API_KEY ortam değişkeni yapılandırılmamış." };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (request.idempotencyKey) {
    headers["Idempotency-Key"] = request.idempotencyKey;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: request.from,
        to: [request.to],
        subject: request.subject,
        html: request.html,
        text: request.text,
        ...(request.replyTo ? { reply_to: request.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Resend (${response.status}): ${await response.text()}`,
      };
    }

    const data = await response.json().catch(() => null);
    return { ok: true, status: response.status, messageId: data?.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 500, error: `Bağlantı hatası: ${message}` };
  }
}
