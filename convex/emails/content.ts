import { formatMoney } from "../../lib/format-money";
import { escapeHtml } from "../../lib/html";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export type EmailTone = "success" | "warning" | "info" | "danger" | "accent";

const BADGE: Record<EmailTone, { bg: string; fg: string; border: string }> = {
  success: { bg: "#ecfdf5", fg: "#059669", border: "#a7f3d0" },
  warning: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
  info: { bg: "#eff6ff", fg: "#2563eb", border: "#bfdbfe" },
  danger: { bg: "#fef2f2", fg: "#dc2626", border: "#fecaca" },
  accent: { bg: "#faf5ff", fg: "#7c3aed", border: "#e9d5ff" },
};

const PANEL = {
  neutral: { bg: "#fafafa", border: "#f0f0f0", label: "#71717a" },
  warning: { bg: "#fffbeb", border: "#fef08a", label: "#92400e" },
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// E-posta istemcileriyle uyumlu inline SVG ikon kütüphanesi
export const ICONS = {
  checkCircle: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
  truck: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
  packageCheck: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="m16 16 2 2 4-4"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  alertCircle: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  bell: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  alertTriangle: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  mail: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  lock: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  sparkles: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
  shoppingBag: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
};

/**
 * Tüm e-postaların tek çerçevesi. `blocks` sırayla gövdeye eklenir;
 * falsy blok atlanır, böylece opsiyonel bölümler çağıranda üçlü ifade gerektirmez.
 */
export function renderEmail(options: {
  storeName: string;
  subject: string;
  icon: string;
  title: string;
  intro: string;
  badge?: { text: string; tone: EmailTone };
  blocks?: (string | false | null | undefined)[];
  footer?: string;
  align?: "left" | "center";
}): string {
  const align = options.align ?? "left";
  const colors = options.badge ? BADGE[options.badge.tone] : null;
  const badge = colors
    ? `<span style="display:inline-block;padding:3px 10px;background-color:${colors.bg};color:${colors.fg};border-radius:9999px;font-size:11px;font-weight:600;border:1px solid ${colors.border};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(options.badge!.text)}</span>`
    : "";
  const blocks = (options.blocks ?? [])
    .filter(Boolean)
    .map(
      (block) =>
        `<tr><td style="padding:0 28px 20px 28px;text-align:${align};">${block}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:${FONT};color:#09090b;line-height:1.5;-webkit-font-smoothing:antialiased;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fafafa;padding:24px 12px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;border-collapse:separate;">
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid #f4f4f5;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-size:16px;font-weight:700;color:#09090b;letter-spacing:-0.02em;">${escapeHtml(options.storeName)}</span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;">${badge}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 16px 28px;text-align:${align};">
              <div style="margin-bottom:14px;color:#09090b;">${options.icon}</div>
              <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#09090b;letter-spacing:-0.02em;">${escapeHtml(options.title)}</h1>
              <p style="margin:0;font-size:14px;color:#52525b;line-height:1.6;">${options.intro}</p>
            </td>
          </tr>
          ${blocks}
          <tr>
            <td style="padding:18px 28px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
              ${options.footer ?? ""}
              <p style="margin:0;font-size:11px;color:#a1a1aa;">© ${escapeHtml(options.storeName)} — Tüm hakları saklıdır.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Vurgulu bilgi kutusu: başlık + içeriği zaten üretilmiş satırlar. */
export function panel(
  label: string,
  rowsHtml: string,
  tone: keyof typeof PANEL = "neutral"
): string {
  const colors = PANEL[tone];
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${colors.bg};border-radius:8px;border:1px solid ${colors.border};">
  <tr>
    <td style="padding:16px 18px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${colors.label};margin-bottom:10px;">${escapeHtml(label)}</div>
      ${rowsHtml}
    </td>
  </tr>
</table>`;
}

/** Bilgi kutusu içinde etiket/değer satırı. */
export function field(label: string, valueHtml: string): string {
  return `<tr>
  <td style="width:110px;color:#71717a;padding:3px 0;font-size:13px;">${escapeHtml(label)}</td>
  <td style="color:#09090b;padding:3px 0;font-size:13px;">${valueHtml}</td>
</tr>`;
}

export function fieldTable(rows: string[]): string {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%">${rows.filter(Boolean).join("")}</table>`;
}

export function cta(href: string, label: string): string {
  return `<div style="text-align:center;margin:28px 0 12px 0;">
  <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 28px;background-color:#09090b;color:#ffffff !important;text-decoration:none;font-size:13px;font-weight:600;border-radius:8px;letter-spacing:-0.01em;">${escapeHtml(label)}</a>
</div>`;
}

export function note(textHtml: string, align: "left" | "center" = "left"): string {
  return `<p style="margin:16px 0 0 0;font-size:12px;color:#71717a;line-height:1.5;text-align:${align};">${textHtml}</p>`;
}

export function linkLine(href: string, label: string): string {
  return `<p style="margin:20px 0 0 0;font-size:12px;color:#a1a1aa;text-align:center;"><a href="${escapeHtml(href)}" style="color:#71717a;text-decoration:underline;">${escapeHtml(label)}</a></p>`;
}

export interface EmailLineItem {
  title: string;
  quantity: number;
  price: string;
  image?: string | null;
  meta?: string | null;
}

/** Sipariş ve sepete bırakılan ürün satırları için tek görünüm. */
export function itemRows(items: EmailLineItem[]): string {
  return items
    .map((item) => {
      const itemTotal = Number(item.price) * item.quantity;
      const imageHtml = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" width="52" height="52" style="display:block;width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid #e4e4e7;margin-right:12px;" />`
        : `<div style="width:52px;height:52px;border-radius:6px;background-color:#f4f4f5;border:1px solid #e4e4e7;color:#a1a1aa;font-size:10px;margin-right:12px;text-align:center;line-height:52px;">Görsel Yok</div>`;

      return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid #f4f4f5;vertical-align:middle;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="width:64px;vertical-align:middle;">${imageHtml}</td>
        <td style="vertical-align:middle;">
          <div style="font-size:13px;font-weight:600;color:#09090b;line-height:1.4;">${escapeHtml(item.title)}</div>
          ${item.meta ? `<div style="font-size:11px;color:#71717a;margin-top:2px;">${escapeHtml(item.meta)}</div>` : ""}
          <div style="font-size:12px;color:#71717a;margin-top:2px;">${item.quantity} adet × ${escapeHtml(formatMoney(item.price))}</div>
        </td>
        <td style="vertical-align:middle;text-align:right;font-size:13px;font-weight:600;color:#09090b;">${escapeHtml(formatMoney(itemTotal))}</td>
      </tr>
    </table>
  </td>
</tr>`;
    })
    .join("");
}

/**
 * Düz metin alternatifi: başlık, ayraçlar ve satırlar.
 * Falsy satırlar atılır; boş satırlar `""` olarak verilir.
 */
export function renderText(options: {
  storeName: string;
  title: string;
  lines: (string | false | null | undefined)[];
}): string {
  const kept = options.lines.filter(
    (line): line is string => line !== false && line !== null && line !== undefined
  );
  return [
    `${options.storeName.toUpperCase()} — ${options.title.toUpperCase()}`,
    "----------------------------------------",
    ...kept,
    "----------------------------------------",
    `© ${options.storeName}`,
  ].join("\n");
}
