import {
  ExtractedDocument,
  ExtractedLineItem,
  ExtractedTaxBreakdown,
} from '../types/document';

function simplify(value: string) {
  return value
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[|¦]/g, ' ')
    .replace(/[^A-Z0-9%.,:/ *-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMoney(raw?: string | null) {
  if (!raw) return 0;
  let value = raw.replace(/[^0-9,.-]/g, '');
  if (!value) return 0;

  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    value = comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  } else if (comma >= 0) {
    const decimals = value.length - comma - 1;
    value = decimals > 0 && decimals <= 2 ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  } else if (dot >= 0) {
    const decimals = value.length - dot - 1;
    if (!(decimals > 0 && decimals <= 2)) value = value.replace(/\./g, '');
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function extractAmounts(line: string) {
  return (line.match(/\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2}/g) ?? [])
    .map(parseMoney)
    .filter((value) => value > 0 && value < 1_000_000);
}

function closeTo(a: number, b: number, relative = 0.035, absolute = 0.75) {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= Math.max(absolute, Math.max(a, b) * relative);
}

function detectTaxRate(text: string) {
  const value = simplify(text);
  if (/%\s*(?:20|2O)\b/.test(value)) return 20;
  if (/%\s*(?:10|1O|IO|I0|LO)\b/.test(value)) return 10;
  if (/%\s*(?:01|1)\b/.test(value)) return 1;
  return null;
}

function inferTaxRate(total: number, tax: number) {
  const base = total - tax;
  if (base <= 0 || tax <= 0) return null;
  const actual = (tax / base) * 100;
  const rates = [1, 10, 20];
  const closest = rates.reduce((best, rate) => (
    Math.abs(rate - actual) < Math.abs(best - actual) ? rate : best
  ));
  return Math.abs(closest - actual) <= 1.25 ? closest : null;
}

function cleanSupplierCandidate(raw: string) {
  let value = raw
    .replace(/[|¦]\s*[a-zA-ZçğıöşüÇĞİÖŞÜ]?\s*:\s*/g, ' ')
    .replace(/\b[eE]\s*:\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const legalEndPatterns = [
    /\b(?:LTD|LIMITED)[\s.,:;|_-]*(?:ŞTİ|STİ|ŞTI|STI|ŞT1|ST1)\.?/i,
    /\b(?:LIMITED\s+(?:ŞİRKETİ|SIRKETI))\b/i,
    /\b(?:A[\s.,:;|_-]*[ŞS])\.?/i,
    /\b(?:ANONİM\s+ŞİRKETİ|ANONIM\s+SIRKETI)\b/i,
  ];

  let legalEnd = -1;
  for (const pattern of legalEndPatterns) {
    const match = value.match(pattern);
    if (match?.index != null) legalEnd = Math.max(legalEnd, match.index + match[0].length);
  }
  if (legalEnd > 0) value = value.slice(0, legalEnd);

  if (legalEnd < 0) {
    const address = value.match(/\b(?:MH\.?|MAH\.?|MAHALLESI|MAHALLESİ|CD\.?|CAD\.?|SOK\.?|SK\.?|TEL|TELEFON)\b/i);
    if (address?.index != null && address.index > 8) value = value.slice(0, address.index);
  }

  return value
    .replace(/^[-:;,.\s]+|[-:;,.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function refineSupplier(document: ExtractedDocument, lines: string[]) {
  const current = document.supplierName.trim();
  const currentNormalized = simplify(current);
  const looksPolluted = /\b(?:MH|MAH|CD|CAD|SOK|TEL|NO)\b/.test(currentNormalized) || current.length > 95;

  if (!looksPolluted && current.length >= 5) return current;

  const top = lines.slice(0, 14);
  const legalIndex = top.findIndex((line) => /LTD|LIMITED|STI|SIRKETI|ANONIM|\bA\s*S\b/.test(simplify(line)));
  if (legalIndex >= 0) {
    const start = Math.max(0, legalIndex - 2);
    const candidate = cleanSupplierCandidate(top.slice(start, legalIndex + 1).join(' '));
    if ((candidate.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length >= 6) return candidate;
  }

  const joined = cleanSupplierCandidate(top.slice(0, 5).join(' '));
  return joined.length >= 5 ? joined : current;
}

function cleanItemDescription(line: string) {
  return line
    .replace(/%\s*(?:20|2[Oo]|10|1[Oo]|[IİLl][Oo0]|0?1)\b/gi, ' ')
    .replace(/[*×x]\s*\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}\b/gi, ' ')
    .replace(/\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}\s*(?:TL|TRY|₺)?\b/gi, ' ')
    .replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findSingleReceiptItem(
  lines: string[],
  total: number,
  taxTotal: number,
): ExtractedLineItem | null {
  if (total <= 0) return null;

  const summaryIndex = lines.findIndex((line) => /TOPKDV|TOP KDV|KDV TOPLAM|^TOPLAM\b/.test(simplify(line)));
  const end = summaryIndex >= 0 ? summaryIndex : Math.min(lines.length, 30);
  const start = Math.max(0, end - 10);
  const inferredRate = inferTaxRate(total, taxTotal);

  const candidates: Array<{ score: number; line: string; total: number; rate: number | null }> = [];
  for (let index = start; index < end; index += 1) {
    const line = lines[index];
    const normalized = simplify(line);
    if (/(TARIH|SAAT|FIS NO|VERGI|VKN|TEL|ADRES|MH\b|MAH\b|KREDI|BANKA|TOPLAM|KDV)/.test(normalized)) continue;

    const letters = (line.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length;
    if (letters < 2) continue;

    const amounts = extractAmounts(line);
    if (!amounts.length) continue;
    const amount = amounts[amounts.length - 1];
    if (!closeTo(amount, total)) continue;

    const rate = detectTaxRate(line) ?? inferredRate;
    let score = 2;
    if (detectTaxRate(line) != null) score += 4;
    if (index >= end - 3) score += 2;
    if (/[A-ZÇĞİÖŞÜ]{2,}/.test(line)) score += 1;
    candidates.push({ score, line, total: amount, rate });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) return null;

  const description = cleanItemDescription(best.line);
  if ((description.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length < 2) return null;

  return {
    description,
    quantity: 1,
    unitPrice: Math.round(best.total * 100) / 100,
    taxRate: best.rate,
    total: Math.round(best.total * 100) / 100,
  };
}

function inferBreakdown(document: ExtractedDocument): ExtractedTaxBreakdown[] | undefined {
  if (document.taxBreakdown?.length) return document.taxBreakdown;
  if (document.total <= 0 || document.taxTotal <= 0) return undefined;

  const rate = inferTaxRate(document.total, document.taxTotal);
  if (rate == null) return undefined;

  return [{
    rate,
    base: Math.round((document.total - document.taxTotal) * 100) / 100,
    tax: Math.round(document.taxTotal * 100) / 100,
  }];
}

export function refineReceiptExtraction(document: ExtractedDocument): ExtractedDocument {
  const rawText = document.rawText?.trim();
  if (!rawText) return document;

  const lines = rawText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const supplierName = refineSupplier(document, lines);
  const taxBreakdown = inferBreakdown(document);
  const fallbackItem = document.items.length === 0
    ? findSingleReceiptItem(lines, document.total, document.taxTotal)
    : null;
  const items = fallbackItem ? [fallbackItem] : document.items;

  const coreCoverage = [
    supplierName,
    document.supplierTaxNumber,
    document.invoiceNumber,
    document.invoiceDate,
    document.total > 0 ? 'total' : '',
    document.taxTotal > 0 ? 'tax' : '',
    items.length > 0 ? 'items' : '',
  ].filter(Boolean).length / 7;
  const arithmeticOk = document.total > 0 && document.subtotal > 0
    && Math.abs(document.subtotal + document.taxTotal - document.total) <= 0.35;
  const confidence = Math.min(
    0.97,
    Math.max(document.confidence, document.confidence * 0.7 + coreCoverage * 0.22 + (arithmeticOk ? 0.08 : 0)),
  );

  return {
    ...document,
    supplierName,
    taxBreakdown,
    items,
    confidence,
  };
}
