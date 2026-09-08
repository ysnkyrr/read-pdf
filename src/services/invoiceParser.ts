import { ExtractedDocument, ExtractedLineItem } from '../types/document';
import { OcrResult } from './ocr';

type ParserInput = {
  uri: string;
  name: string;
  mimeType?: string | null;
  source: 'camera' | 'file';
};

const EMPTY_VALUE = '';

function normalize(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function upperTR(value: string) {
  return value.toLocaleUpperCase('tr-TR');
}

function parseMoney(raw?: string | null) {
  if (!raw) return 0;
  let value = raw.replace(/[^0-9,.-]/g, '');
  if (!value) return 0;

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) value = value.replace(/\./g, '').replace(',', '.');
    else value = value.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimals = value.length - lastComma - 1;
    value = decimals > 0 && decimals <= 2 ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = value.length - lastDot - 1;
    if (!(decimals > 0 && decimals <= 2)) value = value.replace(/\./g, '');
  }

  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return EMPTY_VALUE;
}

function findAmountByLabels(lines: string[], labels: string[]) {
  const normalizedLabels = labels.map(upperTR);
  for (const label of normalizedLabels) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      const upper = upperTR(line);
      if (!upper.includes(label)) continue;
      const amounts = line.match(/\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?/g);
      if (!amounts?.length) continue;
      const value = parseMoney(amounts[amounts.length - 1]);
      if (value > 0) return value;
    }
  }
  return 0;
}

function detectSupplier(lines: string[], text: string) {
  const companyMatch = text.match(/([A-ZÇĞİÖŞÜ0-9][A-Za-zÇĞİÖŞÜçğıöşü0-9 .,&'/-]{2,70}(?:LTD\.? ?ŞTİ\.?|LİMİTED ŞİRKETİ|A\.?Ş\.?|ANONİM ŞİRKETİ|MARKET|MAĞAZA|TEKNOLOJİ|TİCARET))/i);
  if (companyMatch?.[1]) return companyMatch[1].replace(/\s+/g, ' ').trim();

  const ignored = /(E-?FATURA|FATURA|FİŞ|FIS|TARİH|TARIH|SAAT|VKN|TCKN|VERGİ|VERGI|TOPLAM|KDV|MERSİS|ETTN|TEL|WWW|HTTP|SATICI|ALICI)/i;
  for (const line of lines.slice(0, 12)) {
    if (line.length < 3 || line.length > 80 || ignored.test(line)) continue;
    const letterCount = (line.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length;
    if (letterCount >= 3) return line;
  }
  return EMPTY_VALUE;
}

function detectItems(lines: string[]) {
  const blocked = /(TOPLAM|KDV|VERGİ|VERGI|TUTAR|ÖDENECEK|ODENECEK|ARA TOPLAM|FATURA|VKN|TCKN|TARİH|TARIH|SAAT|ETTN|NAKİT|NAKIT|KREDİ|KREDI|POS)/i;
  const items: ExtractedLineItem[] = [];

  for (const line of lines) {
    if (blocked.test(line) || line.length < 5) continue;
    const amountMatch = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s*(?:TL|TRY|₺)?\s*$/i);
    if (!amountMatch) continue;

    const total = parseMoney(amountMatch[1]);
    if (total <= 0) continue;
    let description = line.slice(0, amountMatch.index).trim().replace(/[-:]+$/, '').trim();
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(description)) continue;

    let quantity = 1;
    const quantityMatch = description.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*[xX*]\s*/);
    if (quantityMatch) {
      quantity = parseMoney(quantityMatch[1]) || 1;
      description = description.replace(quantityMatch[0], ' ').trim();
    }

    const taxMatch = description.match(/%\s*(1|10|20)\b/);
    const taxRate = taxMatch ? Number(taxMatch[1]) : null;
    if (taxMatch) description = description.replace(taxMatch[0], '').trim();

    if (!description || description.length > 100) continue;
    items.push({
      description,
      quantity,
      unitPrice: quantity > 0 ? total / quantity : total,
      taxRate,
      total,
    });
    if (items.length >= 30) break;
  }

  return items;
}

function detectDocumentType(text: string): ExtractedDocument['documentType'] {
  if (/E-?FATURA|FATURA NO|FATURA NUMARASI|TEMELFATURA|TİCARİFATURA/i.test(text)) return 'invoice';
  if (/FİŞ NO|FIS NO|YAZAR KASA|PERAKENDE SATIŞ|PERAKENDE SATIS/i.test(text)) return 'receipt';
  return 'unknown';
}

function calculateConfidence(document: Omit<ExtractedDocument, 'confidence'>, ocrConfidence: number) {
  const fields = [
    document.supplierName,
    document.supplierTaxNumber,
    document.invoiceNumber,
    document.invoiceDate,
    document.total > 0 ? 'total' : '',
  ];
  const coverage = fields.filter(Boolean).length / fields.length;
  return Math.max(0.25, Math.min(0.99, ocrConfidence * 0.62 + coverage * 0.38));
}

export function parseInvoiceText(input: ParserInput, ocr: OcrResult): ExtractedDocument {
  const text = normalize(ocr.text);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const searchText = text.replace(/\n/g, ' ');

  const supplierTaxNumber = firstMatch(searchText, [
    /(?:VKN|VERGİ\s*(?:KİMLİK)?\s*(?:NO|NUMARASI)?|VERGI\s*(?:KIMLIK)?\s*(?:NO|NUMARASI)?)\s*[:#-]?\s*(\d{10})/i,
    /\b(\d{10})\b/,
  ]);

  const invoiceNumber = firstMatch(searchText, [
    /(?:FATURA\s*(?:NO|NUMARASI)|BELGE\s*NO|FİŞ\s*NO|FIS\s*NO)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{3,30})/i,
    /\b([A-Z]{2,5}\d{8,20})\b/,
  ]);

  const invoiceDate = firstMatch(searchText, [
    /(?:TARİH|TARIH|DATE)\s*[:#-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/,
  ]);

  const subtotal = findAmountByLabels(lines, ['MAL / HİZMET TOPLAMI', 'MAL HİZMET TOPLAMI', 'ARA TOPLAM', 'MATRAH', 'SUBTOTAL']);
  const taxTotal = findAmountByLabels(lines, ['HESAPLANAN KDV', 'KDV TOPLAMI', 'TOPLAM KDV', 'VERGİ TOPLAMI', 'TAX']);
  const total = findAmountByLabels(lines, ['ÖDENECEK TUTAR', 'ODENECEK TUTAR', 'GENEL TOPLAM', 'VERGİLER DAHİL TOPLAM', 'VERGILER DAHIL TOPLAM', 'TOPLAM', 'TOTAL']);

  const currency = /€|\bEUR\b/i.test(searchText)
    ? 'EUR'
    : /\$|\bUSD\b/i.test(searchText)
      ? 'USD'
      : 'TRY';

  const paymentMethod = /KREDİ\s*KARTI|KREDI\s*KARTI|CREDIT\s*CARD|CARD/i.test(searchText)
    ? 'Kredi Kartı'
    : /NAKİT|NAKIT|CASH/i.test(searchText)
      ? 'Nakit'
      : EMPTY_VALUE;

  const items = detectItems(lines);
  const baseDocument: Omit<ExtractedDocument, 'confidence'> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    source: input.source,
    sourceUri: input.uri,
    fileName: input.name,
    mimeType: input.mimeType,
    documentType: detectDocumentType(searchText),
    supplierName: detectSupplier(lines, searchText),
    supplierTaxNumber,
    invoiceNumber,
    invoiceDate,
    currency,
    subtotal: subtotal || Math.max(0, total - taxTotal),
    taxTotal,
    total,
    paymentMethod,
    items,
    engine: ocr.engine,
    rawText: text,
  };

  return {
    ...baseDocument,
    confidence: calculateConfidence(baseDocument, ocr.confidence),
  };
}
