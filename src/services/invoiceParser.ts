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

function simplify(value: string) {
  return upperTR(value)
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[|]/g, 'I')
    .replace(/[^A-Z0-9%.,:/ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function extractAmounts(line: string) {
  return (
    line.match(/\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?/g) ?? []
  ).map(parseMoney).filter((value) => value > 0);
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return EMPTY_VALUE;
}

function findAmountByLabels(lines: string[], labels: string[]) {
  const normalizedLabels = labels.map(simplify);

  for (const label of normalizedLabels) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const normalizedLine = simplify(lines[index]);
      if (!normalizedLine.includes(label)) continue;

      const sameLineAmounts = extractAmounts(lines[index]);
      if (sameLineAmounts.length) return sameLineAmounts[sameLineAmounts.length - 1];

      for (let offset = 1; offset <= 2; offset += 1) {
        const neighbor = lines[index + offset];
        if (!neighbor) break;
        const neighborAmounts = extractAmounts(neighbor);
        if (neighborAmounts.length) return neighborAmounts[neighborAmounts.length - 1];
      }
    }
  }

  return 0;
}

function calculateVknCheckDigit(firstNine: string) {
  if (!/^\d{9}$/.test(firstNine)) return null;
  const digits = firstNine.split('').map(Number);
  let sum = 0;

  digits.forEach((digit, index) => {
    let value = (digit + (9 - index)) % 10;
    if (value !== 0) {
      value = (value * 2 ** (9 - index)) % 9;
      if (value === 0) value = 9;
    }
    sum += value;
  });

  return (10 - (sum % 10)) % 10;
}

function normalizeVkn(candidate: string) {
  if (!/^\d{10}$/.test(candidate)) return candidate;
  const expected = calculateVknCheckDigit(candidate.slice(0, 9));
  if (expected == null) return candidate;
  if (Number(candidate[9]) === expected) return candidate;
  return `${candidate.slice(0, 9)}${expected}`;
}

function detectTaxNumber(searchText: string) {
  const labeled = firstMatch(searchText, [
    /(?:VKN|VN|V\.N\.|VERGI\s*(?:KIMLIK)?\s*(?:NO|NUMARASI)?|VERGI\s*NO)\s*[:#-]?\s*(\d{10})/i,
  ]);

  if (labeled) return normalizeVkn(labeled);

  const candidates = searchText.match(/\b\d{10}\b/g) ?? [];
  for (const candidate of candidates) {
    const normalized = normalizeVkn(candidate);
    if (normalized) return normalized;
  }
  return EMPTY_VALUE;
}

function normalizeDateCandidate(raw: string) {
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

function detectDate(text: string) {
  const candidates = text.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g) ?? [];
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const normalized = normalizeDateCandidate(candidate);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  let best = EMPTY_VALUE;
  let bestCount = 0;
  for (const [date, count] of counts.entries()) {
    if (count > bestCount) {
      best = date;
      bestCount = count;
    }
  }

  return best;
}

function detectSupplier(lines: string[]) {
  const ignored = /(E-?ARSIV|E-?FATURA|FATURA|FIS|TARIH|SAAT|VKN|TCKN|VERGI|TOPLAM|KDV|MERSIS|ETTN|TEL|WWW|HTTP|SATICI|ALICI|NIHAI TUKETICI)/i;
  const candidates = lines.slice(0, 18)
    .map((line) => ({ raw: line.trim(), normalized: simplify(line) }))
    .filter(({ raw, normalized }) => {
      if (raw.length < 4 || raw.length > 120 || ignored.test(normalized)) return false;
      const letters = (raw.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length;
      return letters >= 4;
    })
    .map((candidate) => {
      const value = candidate.normalized;
      let score = 0;
      if (/\bA\.?\s*S\.?\b|ANONIM SIRKETI/.test(value)) score += 8;
      if (/LTD|LIMITED|STI|SIRKETI/.test(value)) score += 7;
      if (/SUPERMARKET|MARKET|MAGAZA/.test(value)) score += 5;
      if (/TIC|TICARET/.test(value)) score += 4;
      if (/GIDA|SAN|INS|TEKNOLOJI/.test(value)) score += 2;
      score += Math.min(5, candidate.raw.length / 18);
      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score || b.raw.length - a.raw.length);

  return candidates[0]?.raw ?? EMPTY_VALUE;
}

function detectVatBreakdown(lines: string[]) {
  const headerIndex = lines.findIndex((line) => {
    const value = simplify(line);
    return value.includes('KDV') && value.includes('MATRAH');
  });

  if (headerIndex < 0) return { base: 0, tax: 0 };

  let base = 0;
  let tax = 0;
  let rows = 0;

  for (let index = headerIndex + 1; index < Math.min(lines.length, headerIndex + 10); index += 1) {
    const line = simplify(lines[index]);
    if (/KDV TOPLAM|BRUT TOPLAM|ODENECEK|GENEL TOPLAM/.test(line)) break;

    const rateMatch = line.match(/%\s*0?(1|10|20)\b/);
    if (!rateMatch) continue;

    const amounts = extractAmounts(lines[index]);
    const rate = Number(rateMatch[1]);
    const filtered = amounts.filter((amount) => amount !== rate && amount !== Number(`0${rate}`));
    if (filtered.length < 2) continue;

    base += filtered[filtered.length - 2];
    tax += filtered[filtered.length - 1];
    rows += 1;
  }

  return rows > 0 ? { base, tax } : { base: 0, tax: 0 };
}

function isLikelyProductDescription(line: string) {
  const normalized = simplify(line);
  if (!normalized || normalized.length < 4 || normalized.length > 110) return false;
  if (/(TOPLAM|KDV|VERGI|TUTAR|FATURA|VKN|TCKN|TARIH|SAAT|ETTN|MERSIS|KREDI|NAKIT|BANKA|REF|MAIL|E-POSTA|WWW|HTTP)/.test(normalized)) return false;
  if (/\b\d{8,14}\b/.test(normalized) && (normalized.match(/[A-Z]/g) ?? []).length < 5) return false;
  return (normalized.match(/[A-Z]/g) ?? []).length >= 4;
}

function cleanDescription(line: string) {
  return line
    .replace(/^\s*\d+\s+/, '')
    .replace(/\b\d{8,14}\b/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:ADET|AD\.?|PKT|PAKET|KG|GR|LT|ML)\b/gi, ' ')
    .replace(/%\s*0?(?:1|10|20)\b/g, ' ')
    .replace(/\d{1,3}(?:\.\d{3})*,\d{2}\s*(?:TL|TRY|₺)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-:|]+|[-:|]+$/g, '')
    .trim();
}

function detectItems(lines: string[]) {
  const blocked = /(TOPLAM|KDV TOPLAM|VERGI|ODENECEK|ARA TOPLAM|BRUT TOPLAM|GENEL TOPLAM|FATURA|VKN|TCKN|TARIH|SAAT|ETTN|MERSIS|NAKIT|KREDI|POS|BANKA)/i;
  const items: ExtractedLineItem[] = [];
  const usedDescriptions = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalizedLine = simplify(line);
    if (blocked.test(normalizedLine) || line.length < 5) continue;

    const amountTokens = line.match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}/g) ?? [];
    if (!amountTokens.length) continue;

    const total = parseMoney(amountTokens[amountTokens.length - 1]);
    if (total <= 0) continue;

    const taxMatch = normalizedLine.match(/%\s*0?(1|10|20)\b/);
    const taxRate = taxMatch ? Number(taxMatch[1]) : null;

    const quantityMatch = normalizedLine.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:ADET|AD\.?|PKT|PAKET|X|\*)\b/i);
    const quantity = quantityMatch ? parseMoney(quantityMatch[1]) || 1 : 1;

    let description = cleanDescription(line);
    const descriptionLetters = (description.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length;

    if (descriptionLetters < 5 || /^\D*\d{5,}/.test(description)) {
      const neighborIndexes = [index + 1, index - 1];
      for (const neighborIndex of neighborIndexes) {
        if (neighborIndex < 0 || neighborIndex >= lines.length || usedDescriptions.has(neighborIndex)) continue;
        const neighbor = lines[neighborIndex];
        if (!isLikelyProductDescription(neighbor)) continue;
        const neighborDescription = cleanDescription(neighbor);
        if ((neighborDescription.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length >= 5) {
          description = neighborDescription;
          usedDescriptions.add(neighborIndex);
          break;
        }
      }
    }

    if (!description || (description.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length < 3) continue;

    const unitPrice = amountTokens.length >= 2
      ? parseMoney(amountTokens[amountTokens.length - 2])
      : quantity > 0
        ? total / quantity
        : total;

    items.push({
      description,
      quantity,
      unitPrice: unitPrice || total,
      taxRate,
      total,
    });

    if (items.length >= 30) break;
  }

  return items;
}

function detectDocumentType(text: string): ExtractedDocument['documentType'] {
  const normalized = simplify(text);
  if (/E-?ARSIV FATURA|E-?FATURA|FATURA NO|FATURANO|TEMELFATURA|TICARIFATURA/.test(normalized)) return 'invoice';
  if (/FIS NO|YAZAR KASA|PERAKENDE SATIS/.test(normalized)) return 'receipt';
  return 'unknown';
}

function calculateConfidence(document: Omit<ExtractedDocument, 'confidence'>, ocrConfidence: number) {
  const coverageFields = [
    document.supplierName,
    document.supplierTaxNumber,
    document.invoiceNumber,
    document.invoiceDate,
    document.total > 0 ? 'total' : '',
    document.taxTotal > 0 ? 'tax' : '',
    document.items.length > 0 ? 'items' : '',
  ];
  const coverage = coverageFields.filter(Boolean).length / coverageFields.length;
  const arithmeticMatches = document.total > 0 && document.subtotal > 0
    ? Math.abs(document.subtotal + document.taxTotal - document.total) <= 0.15
    : false;
  const consistency = arithmeticMatches ? 1 : document.total > 0 ? 0.55 : 0.25;

  return Math.max(
    0.25,
    Math.min(0.99, ocrConfidence * 0.42 + coverage * 0.38 + consistency * 0.2),
  );
}

export function parseInvoiceText(input: ParserInput, ocr: OcrResult): ExtractedDocument {
  const text = normalize(ocr.text);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const searchText = text.replace(/\n/g, ' ');
  const simplifiedSearchText = simplify(searchText);

  const supplierTaxNumber = detectTaxNumber(simplifiedSearchText);

  const invoiceNumber = firstMatch(simplifiedSearchText, [
    /(?:FATURA\s*(?:NO|NUMARASI|N0)|FATURANO)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{3,30})/i,
    /\b([A-Z]{1,5}\d{10,22})\b/,
    /(?:FIS\s*(?:NO|NUMARASI|N0))\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{2,20})/i,
  ]);

  const invoiceDate = detectDate(searchText);
  const vatBreakdown = detectVatBreakdown(lines);

  const labeledTaxTotal = findAmountByLabels(lines, [
    'KDV TOPLAM',
    'KDV TOPLAMI',
    'HESAPLANAN KDV',
    'TOPLAM KDV',
    'VERGİ TOPLAMI',
    'TAX',
  ]);
  const taxTotal = labeledTaxTotal || vatBreakdown.tax;

  const total = findAmountByLabels(lines, [
    'ÖDENECEK KDV DAHİL TUTAR',
    'ODENECEK KDV DAHIL TUTAR',
    'ÖDENECEK TUTAR',
    'ODENECEK TUTAR',
    'BRÜT TOPLAM',
    'BRUT TOPLAM',
    'GENEL TOPLAM',
    'VERGİLER DAHİL TOPLAM',
    'VERGILER DAHIL TOPLAM',
    'TOPLAM',
    'TOTAL',
  ]);

  const labeledSubtotal = findAmountByLabels(lines, [
    'MAL / HİZMET TOPLAMI',
    'MAL HİZMET TOPLAMI',
    'ARA TOPLAM',
    'SUBTOTAL',
  ]);
  const subtotal = labeledSubtotal || vatBreakdown.base || Math.max(0, total - taxTotal);

  const hasTry = /\bTRY\b|\bTL\b|TURK\s*LIRASI|TÜRK\s*LİRASI|₺/i.test(searchText);
  const currency = hasTry
    ? 'TRY'
    : /\bEUR\b|€/i.test(searchText)
      ? 'EUR'
      : /\bUSD\b/i.test(searchText)
        ? 'USD'
        : 'TRY';

  const paymentMethod = /KREDI\s*KARTI|KREDİ\s*KARTI|CREDIT\s*CARD|BANKA\s*KARTI|CARD/i.test(simplifiedSearchText)
    ? 'Kredi Kartı'
    : /NAKIT|CASH/i.test(simplifiedSearchText)
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
    supplierName: detectSupplier(lines),
    supplierTaxNumber,
    invoiceNumber,
    invoiceDate,
    currency,
    subtotal,
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
