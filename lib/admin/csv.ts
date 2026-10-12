// Noktalı virgül ayırıcı ve UTF-8 BOM, Türkçe Excel'in dosyayı doğru sütunlara ayırması için seçildi.
const DELIMITER = ";";

function escapeCell(value: string) {
  let sanitized = value;
  // CSV / spreadsheet formula injection (CWE-1236) koruması:
  // Hücre =, +, -, @ veya tab/satır başı ile başlıyorsa formül/DDE yürütülmesini engellemek için tek tırnak eklenir.
  if (/^[\s]*[=+\-@\t\r]/.test(sanitized)) {
    sanitized = `'${sanitized}`;
  }

  const needsQuotes =
    sanitized.includes('"') ||
    sanitized.includes("\n") ||
    sanitized.includes("\r") ||
    sanitized.includes(DELIMITER);

  return needsQuotes ? `"${sanitized.replace(/"/g, '""')}"` : sanitized;
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>) {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCell(String(cell ?? ""))).join(DELIMITER),
  );
  return `\uFEFF${lines.join("\r\n")}`;
}
