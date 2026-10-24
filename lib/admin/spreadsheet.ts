import * as XLSX from "xlsx";

type SheetRow = {
  rowNumber: number;
  sheetRow: number;
  cells: string[];
};

export type SheetTable = {
  headers: string[];
  rows: SheetRow[];
};

function detectDelimiter(text: string): string {
  let semicolon = 0;
  let comma = 0;
  let quoted = false;
  for (let i = 0; i < text.length && i < 2000; i++) {
    const char = text[i];
    if (char === '"') quoted = !quoted;
    else if (!quoted) {
      if (char === "\n" || char === "\r") break;
      if (char === ";") semicolon++;
      else if (char === ",") comma++;
    }
  }
  return semicolon >= comma && semicolon > 0 ? ";" : ",";
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

export const MAX_SPREADSHEET_ROWS = 5000;

function decodeCsvBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8;
  try {
    return new TextDecoder("windows-1254").decode(buffer);
  } catch {
    return utf8;
  }
}

function readCsvTable(text: string): SheetTable {
  const matrix = parseCsv(text, detectDelimiter(text));
  if (matrix.length === 0) return { headers: [], rows: [] };
  if (matrix.length - 1 > MAX_SPREADSHEET_ROWS) {
    throw new Error(`Dosya en fazla ${MAX_SPREADSHEET_ROWS} ürün satırı içerebilir.`);
  }

  const headers = matrix[0] ?? [];
  const rows: SheetRow[] = [];
  for (let index = 1; index < matrix.length; index++) {
    rows.push({ rowNumber: index + 1, sheetRow: index, cells: matrix[index] ?? [] });
  }
  return { headers, rows };
}

function tableFromMatrix(matrix: unknown[][]): SheetTable {
  const nonEmpty = (row: unknown[] | undefined) =>
    Boolean(row?.some((cell) => String(cell ?? "").trim().length > 0));

  const headerIndex = matrix.findIndex(nonEmpty);
  if (headerIndex < 0) return { headers: [], rows: [] };

  const headers = (matrix[headerIndex] ?? []).map((cell) => String(cell ?? "").trim());
  const rows: SheetRow[] = [];
  for (let index = headerIndex + 1; index < matrix.length; index++) {
    if (!nonEmpty(matrix[index])) continue;
    rows.push({
      rowNumber: index + 1,
      sheetRow: index,
      cells: headers.map((_, column) => String(matrix[index]?.[column] ?? "").trim()),
    });
  }
  return { headers, rows };
}

function resolveZipPath(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${baseDir}/${target}`.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function relationshipTarget(xml: string, id: string): string | undefined {
  const tag = [...xml.matchAll(/<Relationship\b[^>]*>/g)]
    .map((match) => match[0])
    .find((entry) => new RegExp(`\\bId="${id}"`).test(entry));
  return tag ? /Target="([^"]+)"/.exec(tag)?.[1] : undefined;
}

function extractEmbeddedImagesByRow(buffer: Buffer): Map<number, Buffer[]> {
  const result = new Map<number, Buffer[]>();
  try {
    const zip = XLSX.CFB.read(buffer, { type: "buffer" });
    const files = new Map<string, Buffer>();
    for (let index = 0; index < zip.FileIndex.length; index++) {
      const entry = zip.FileIndex[index];
      const path = String(zip.FullPaths[index] ?? "").replace(/^Root Entry\//, "");
      if (!entry.content || !path) continue;
      files.set(path, Buffer.from(entry.content));
    }

    const workbookXml = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
    const firstSheetId = /<sheet\b[^>]*r:id="([^"]+)"/.exec(workbookXml)?.[1];
    const workbookRels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
    const sheetTarget = firstSheetId ? relationshipTarget(workbookRels, firstSheetId) : undefined;
    if (!sheetTarget) return result;

    const sheetPath = resolveZipPath("xl", sheetTarget);
    const sheetFile = sheetPath.split("/").pop() ?? "";
    const sheetRels = files.get(`xl/worksheets/_rels/${sheetFile}.rels`)?.toString("utf8") ?? "";

    const drawingTargets = [...sheetRels.matchAll(/<Relationship\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => /Type="[^"]*\/drawing"/.test(tag))
      .map((tag) => /Target="([^"]+)"/.exec(tag)?.[1])
      .filter((target): target is string => Boolean(target));

    for (const drawingTarget of drawingTargets) {
      const drawingPath = resolveZipPath("xl/worksheets", drawingTarget);
      const drawingFile = drawingPath.split("/").pop() ?? "";
      const drawingXml = files.get(drawingPath)?.toString("utf8") ?? "";
      const drawingRels = files.get(`xl/drawings/_rels/${drawingFile}.rels`)?.toString("utf8") ?? "";

      for (const anchor of drawingXml.split(/<xdr:(?:twoCellAnchor|oneCellAnchor)\b/).slice(1)) {
        const row = Number(/<xdr:row>(\d+)<\/xdr:row>/.exec(anchor)?.[1]);
        if (!Number.isInteger(row) || row < 0) continue;
        for (const blip of anchor.matchAll(/r:embed="([^"]+)"/g)) {
          const target = relationshipTarget(drawingRels, blip[1]!);
          if (!target) continue;
          const media = files.get(resolveZipPath("xl/drawings", target));
          if (!media || media.length === 0) continue;
          const rowImages = result.get(row) ?? [];
          rowImages.push(media);
          result.set(row, rowImages);
        }
      }
    }
  } catch {
    return result;
  }
  return result;
}

export function readSpreadsheetTable(buffer: Buffer): { table: SheetTable; embedded: Map<number, Buffer[]> } {
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isLegacyXls = buffer.length > 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;

  if (!isZip && !isLegacyXls) {
    return {
      table: readCsvTable(decodeCsvBuffer(buffer).replace(/^\uFEFF/, "")),
      embedded: new Map(),
    };
  }

  const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: MAX_SPREADSHEET_ROWS + 2 });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { table: { headers: [], rows: [] }, embedded: new Map() };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: true,
  });
  if (matrix.length - 1 > MAX_SPREADSHEET_ROWS) {
    throw new Error(`Dosya en fazla ${MAX_SPREADSHEET_ROWS} ürün satırı içerebilir.`);
  }

  return {
    table: tableFromMatrix(matrix),
    embedded: isZip ? extractEmbeddedImagesByRow(buffer) : new Map(),
  };
}
