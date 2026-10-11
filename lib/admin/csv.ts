// Noktalı virgül ayırıcı ve UTF-8 BOM, Türkçe Excel'in dosyayı doğru sütunlara ayırması için seçildi.
const DELIMITER = ";";

function escapeCell(value: string) {
  return /["\n\r;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>) {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCell(String(cell ?? ""))).join(DELIMITER),
  );
  return `\uFEFF${lines.join("\r\n")}`;
}
