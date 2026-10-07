const allowedTags = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

const voidTags = new Set(["br", "hr"]);

function escapeText(value: string) {
  return value
    .replace(/&(?!(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeHref(attributes: string) {
  const match = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const href = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  if (!href || /[\u0000-\u0020]/.test(href)) return null;
  if (!/^(?:https?:\/\/|mailto:|tel:|\/(?![\\/])|#)/i.test(href)) return null;
  return href
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Keep only basic markup and safe link targets. */
export function sanitizeHtml(html: string) {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(?:script|style|iframe|object|embed|form|svg|math|template|noscript)\b[^>]*>/gi, "");
  const tagPattern = /<\s*(\/?)\s*([a-z][a-z0-9-]*)\b([^<>]*?)>/gi;
  let result = "";
  let cursor = 0;

  for (const match of source.matchAll(tagPattern)) {
    const index = match.index ?? 0;
    result += escapeText(source.slice(cursor, index));
    cursor = index + match[0].length;

    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (!allowedTags.has(tag)) continue;
    if (closing) {
      if (!voidTags.has(tag)) result += `</${tag}>`;
      continue;
    }

    if (tag === "a") {
      const href = safeHref(match[3]);
      result += href ? `<a href="${href}" rel="noopener noreferrer">` : "<a>";
    } else {
      result += `<${tag}>`;
    }
  }

  result += escapeText(source.slice(cursor));
  return result;
}
