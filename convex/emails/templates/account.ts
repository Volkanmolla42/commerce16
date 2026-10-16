import { escapeHtml } from "../../../lib/html";
import {
  cta,
  ICONS,
  note,
  panel,
  renderEmail,
  renderText,
  type EmailContent,
} from "../content";

export interface WelcomeEmailData {
  storeName: string;
  userName: string | null;
  siteUrl: string;
}

export function renderWelcomeEmail(data: WelcomeEmailData): EmailContent {
  const subject = `${data.storeName} hesabınız hazır`;
  const greetingName = data.userName ? ` <strong>${escapeHtml(data.userName)}</strong>` : "";

  const html = renderEmail({
    storeName: data.storeName,
    subject,
    icon: ICONS.sparkles,
    title: "Aramıza Hoş Geldiniz",
    intro: `Merhaba${greetingName}, hesabınız başarıyla oluşturuldu.`,
    badge: { text: "Hesap Açıldı", tone: "success" },
    align: "center",
    blocks: [
      panel(
        "Hesabınızla neler yapabilirsiniz?",
        `<ul style="margin:0;padding-left:18px;font-size:13px;color:#52525b;line-height:1.7;text-align:left;">
  <li>Siparişlerinizi ve kargo durumunu takip edebilirsiniz.</li>
  <li>Beğendiğiniz ürünleri favorilerinize ekleyebilirsiniz.</li>
  <li>Teslimat adreslerinizi kaydederek daha hızlı alışveriş yapabilirsiniz.</li>
</ul>`
      ),
      cta(data.siteUrl, "Alışverişe Başla"),
    ],
  });

  const text = renderText({
    storeName: data.storeName,
    title: subject,
    lines: [
      `Merhaba${data.userName ? ` ${data.userName}` : ""}, hesabınız başarıyla oluşturuldu.`,
      "",
      "Hesabınızla siparişlerinizi takip edebilir, ürünleri favorilerinize ekleyebilir ve adreslerinizi kaydedebilirsiniz.",
      "",
      `Alışverişe devam edin: ${data.siteUrl}`,
    ],
  });

  return { subject, html, text };
}

export interface OtpEmailData {
  storeName: string;
  token: string;
  purpose: "reset" | "change";
}

/** Şifre sıfırlama ve şifre değiştirme tek şablon; yalnızca metni farklıdır. */
export function renderOtpEmail(data: OtpEmailData): EmailContent {
  const isReset = data.purpose === "reset";
  const label = isReset ? "Şifre Sıfırlama" : "Şifre Değiştirme";
  const subject = `${label} Kodunuz | ${data.storeName}`;

  const codeBox = `<div style="margin:20px auto;padding:14px 28px;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:8px;font-size:30px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#09090b;display:inline-block;">${escapeHtml(data.token)}</div>`;

  const html = renderEmail({
    storeName: data.storeName,
    subject,
    icon: ICONS.lock,
    title: `${label} Kodu`,
    intro: `Hesabınızın şifresini ${isReset ? "yenilemek" : "değiştirmek"} için talepte bulundunuz. Aşağıdaki tek kullanımlık kodu ekrandaki alana giriniz:`,
    badge: { text: "Doğrulama", tone: "info" },
    align: "center",
    blocks: [
      codeBox,
      note(
        "Bu kod güvenliğiniz için <strong>sınırlı süreyle</strong> geçerlidir.<br />Lütfen bu kodu kimseyle paylaşmayınız.",
        "center"
      ),
      panel(
        "Güvenlik Hatırlatması",
        `<p style="margin:0;font-size:12px;color:#71717a;line-height:1.5;">Bu talebi siz gerçekleştirmediyseniz${isReset ? ", hiçbir işlem yapmanıza gerek yoktur. Hesabınız güvendedir." : ", şifreniz değişmemiştir; bu e-postayı dikkate almanıza gerek yoktur."}</p>`
      ),
    ],
  });

  const text = renderText({
    storeName: data.storeName,
    title: subject,
    lines: [
      `Hesabınız için bir ${label.toLowerCase()} talebinde bulundunuz.`,
      "",
      `Tek kullanımlık kodunuz: ${data.token}`,
      "",
      "Bu kod sınırlı süreyle geçerlidir ve kimseyle paylaşılmamalıdır.",
      isReset
        ? "Bu talebi siz yapmadıysanız hesabınız güvendedir; kodu dikkate almayınız."
        : "Bu talebi siz yapmadıysanız şifreniz değişmemiştir; kodu dikkate almayınız.",
    ],
  });

  return { subject, html, text };
}
