import {
  ExtractedDocument,
  ExtractedLineItem,
  ExtractedTaxBreakdown,
} from '../types/document';
import { OcrResult } from './ocr';

type ParserInput = {
  uri: string;
  name: string;
  mimeType?: string | null;
  source: 'camera' | 'file';
};

type AmountCandidate = {
  value: number;
  weight: number;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    value = decimals > 0 && decimals <= 2
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimals = value.length - lastDot - 1;
    if (!(decimals > 0 && decimals <= 2)) value = value.replace(/\./g, '');
  }

  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function extractDecimalAmounts(line: string) {
  return (
    line.match(/\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2}/g) ?? []
  )
    .map(parseMoney)
    .filter((value) => value > 0 && value < 1_000_000);
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return EMPTY_VALUE;
}

function amountsClose(a: number, b: number, relativeTolerance = 0.045, absoluteTolerance = 1) {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) <= Math.max(absoluteTolerance, Math.max(a, b) * relativeTolerance);
}

function chooseConsensusAmount(candidates: AmountCandidate[]) {
  const valid = candidates.filter((candidate) => candidate.value > 0 && Number.isFinite(candidate.value));
  if (!valid.length) return 0;

  let best = valid[0];
  let bestScore = -1;

  for (const candidate of valid) {
    let score = candidate.weight;
    for (const other of valid) {
      if (other === candidate) continue;
      if (amountsClose(candidate.value, other.value)) score += other.weight;
    }

    if (score > bestScore || (score === bestScore && candidate.weight > best.weight)) {
      best = candidate;
      bestScore = score;
    }
  }

  const agreeing = valid.filter((candidate) => amountsClose(candidate.value, best.value));
  if (agreeing.length <= 1) return roundMoney(best.value);

  const weighted = agreeing.reduce(
    (acc, candidate) => ({
      total: acc.total + candidate.value * candidate.weight,
      weight: acc.weight + candidate.weight,
    }),
    { total: 0, weight: 0 },
  );

  return roundMoney(weighted.total / Math.max(1, weighted.weight));
}

function findAmountByLabels(lines: string[], labels: string[]) {
  const normalizedLabels = labels.map(simplify);

  for (const label of normalizedLabels) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const normalizedLine = simplify(lines[index]);
      if (!normalizedLine.includes(label)) continue;

      const sameLineAmounts = extractDecimalAmounts(lines[index]);
      if (sameLineAmounts.length) return sameLineAmounts[sameLineAmounts.length - 1];

      const neighbor = lines[index + 1];
      if (!neighbor) continue;
      const neighborNormalized = simplify(neighbor);
      if (/TARIH|SAAT|REF|ID|ETTN/.test(neighborNormalized)) continue;
      const neighborAmounts = extractDecimalAmounts(neighbor);
      if (neighborAmounts.length === 1) return neighborAmounts[0];
    }
  }

  return 0;
}

function findReceiptTotal(lines: string[]) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const normalized = simplify(lines[index]);
    if (/KDV|INDIRIM|ARA TOPLAM|PUAN/.test(normalized)) continue;
    if (!/^(?:TOPLAM|GENEL TOPLAM|TUTAR)\b/.test(normalized)) continue;
    const amounts = extractDecimalAmounts(lines[index]);
    if (amounts.length) return amounts[amounts.length - 1];
  }
  return 0;
}

function detectRepeatedAmount(lines: string[]) {
  const scores = new Map<string, { value: number; score: number; hits: number }>();

  for (const line of lines) {
    const normalized = simplify(line);
    let lineWeight = 1;
    if (/TOPLAM|TUTAR|ODENECEK|KREDI|NAKIT|POS|TRY|\bTL\b/.test(normalized)) lineWeight += 2.5;
    if (/TARIH|SAAT|REF|ETTN|MERSIS|BAT\.ID|IS\.ID|PUAN/.test(normalized)) lineWeight *= 0.25;

    for (const amount of extractDecimalAmounts(line)) {
      if (amount < 5 || amount > 100_000) continue;
      const key = amount.toFixed(2);
      const current = scores.get(key) ?? { value: amount, score: 0, hits: 0 };
      current.score += lineWeight;
      current.hits += 1;
      scores.set(key, current);
    }
  }

  const ranked = [...scores.values()]
    .filter((entry) => entry.hits >= 2)
    .sort((a, b) => b.score - a.score || b.hits - a.hits || b.value - a.value);

  return ranked[0]?.value ?? 0;
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

function isValidVkn(candidate: string) {
  if (!/^\d{10}$/.test(candidate)) return false;
  const expected = calculateVknCheckDigit(candidate.slice(0, 9));
  return expected != null && Number(candidate[9]) === expected;
}

function repairLabeledVkn(candidate: string) {
  if (!/^\d{10}$/.test(candidate)) return candidate;
  if (isValidVkn(candidate)) return candidate;
  const expected = calculateVknCheckDigit(candidate.slice(0, 9));
  return expected == null ? candidate : `${candidate.slice(0, 9)}${expected}`;
}

function detectTaxNumber(searchText: string) {
  const labeled = firstMatch(searchText, [
    /(?:VKN|VN|V\.N\.|VERGI\s*(?:KIMLIK)?\s*(?:NO|NUMARASI)?|VERGI\s*NO)\s*[:#-]?\s*(\d{10})/i,
  ]);

  if (labeled) return repairLabeledVkn(labeled);

  const candidates = searchText.match(/\b\d{10}\b/g) ?? [];
  return candidates.find(isValidVkn) ?? EMPTY_VALUE;
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

function detectDate(lines: string[], text: string) {
  const weighted = new Map<string, number>();

  for (const line of lines) {
    const normalizedLine = simplify(line);
    const weight = /TARIH|OLUSTURMA|SEVK/.test(normalizedLine) ? 3 : /BANKA|BAT\.ID|IS\.ID/.test(normalizedLine) ? 0.4 : 1;
    const candidates = line.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g) ?? [];
    for (const candidate of candidates) {
      const normalized = normalizeDateCandidate(candidate);
      if (!normalized) continue;
      weighted.set(normalized, (weighted.get(normalized) ?? 0) + weight);
    }
  }

  if (!weighted.size) {
    const candidates = text.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g) ?? [];
    for (const candidate of candidates) {
      const normalized = normalizeDateCandidate(candidate);
      if (normalized) weighted.set(normalized, (weighted.get(normalized) ?? 0) + 1);
    }
  }

  return [...weighted.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? EMPTY_VALUE;
}

function normalizeCommonReceiptTerm(value: string) {
  const compact = simplify(value).replace(/[.\s_-]+/g, '');
  if (/^[MN]GIYI[MN]$/.test(compact) || compact === 'GIYIM' || compact === 'GIYIN') {
    return 'M.GİYİM';
  }
  return value;
}

function cleanSupplierName(raw: string) {
  let value = raw
    .replace(/^(?:[I1l|]\s*[-—–|.:]+\s*)+/, '')
    .replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]+/, '')
    .replace(/\s*[|]\s*[.:-]?\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();

  const corporateEnd = value.match(/\b(?:LTD\.?[,\s]*(?:ŞTİ|STI)\.?|LIMITED\s+ŞIRKETI|LIMITED\s+SIRKETI|A\.?\s*[ŞS]\.?|ANONIM\s+ŞIRKETI|ANONIM\s+SIRKETI)\b/i);
  if (corporateEnd?.index != null) {
    value = value.slice(0, corporateEnd.index + corporateEnd[0].length).trim();
  }

  return value
    .replace(/\bA[ŞS][EİI]?\.?\s*$/i, 'A.Ş.')
    .replace(/\s*[·|]\s*[·|]+\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSupplier(lines: string[]) {
  const top = lines.slice(0, 18);
  const ignored = /(E-?ARSIV|E-?FATURA|FATURA|FIS|TARIH|SAAT|VKN|TCKN|VERGI|TOPLAM|KDV|MERSIS|ETTN|TEL|WWW|HTTP|SATICI|ALICI|NIHAI TUKETICI)/i;
  const windows: string[] = [];

  for (let index = 0; index < top.length; index += 1) {
    for (let size = 1; size <= 3; size += 1) {
      if (index + size > top.length) continue;
      windows.push(top.slice(index, index + size).join(' '));
    }
  }

  const candidates = windows
    .map((raw) => ({ raw: raw.trim(), normalized: simplify(raw) }))
    .filter(({ raw, normalized }) => {
      if (raw.length < 4 || raw.length > 220 || ignored.test(normalized)) return false;
      const letters = (raw.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length;
      return letters >= 4;
    })
    .map((candidate) => {
      const value = candidate.normalized;
      let score = 0;
      if (/LTD|LIMITED|STI|SIRKETI/.test(value)) score += 11;
      if (/\bA\.?\s*S\.?\b|ANONIM SIRKETI|\bASE?\b/.test(value)) score += 10;
      if (/TIC|TICARET/.test(value)) score += 6;
      if (/SUPERMARKET|MARKET|MAGAZA/.test(value)) score += 5;
      if (/TEKS|TEKSTIL|GIDA|SAN|INS|TAAH|TUR|TEKNOLOJI/.test(value)) score += 2;
      if (/MH\.|MAH|CAD|CD\.|SOK|NO:|ANKARA|ISTANBUL|IZMIR/.test(value)) score -= 2;
      score += Math.min(5, candidate.raw.length / 30);
      return { ...candidate, score };
    })
    .sort((a, b) => b.score - a.score || b.raw.length - a.raw.length);

  return cleanSupplierName(candidates[0]?.raw ?? EMPTY_VALUE);
}

function findItemRegion(lines: string[]) {
  let start = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const value = simplify(lines[index]);
    const headerSignals = ['BARKOD', 'URUN', 'MIKTAR', 'FIYAT', 'TUTAR'].filter((token) => value.includes(token)).length;
    if (headerSignals >= 2) {
      start = index + 1;
      break;
    }
  }

  if (start < 0) {
    start = lines.findIndex((line) => /\b\d{8,14}\b/.test(line) && extractDecimalAmounts(line).length > 0);
  }

  if (start < 0) {
    start = lines.findIndex((line) => {
      const value = simplify(line);
      const hasTax = /%\s*0?(1|10|20)\b/.test(value);
      const hasAmount = extractDecimalAmounts(line).length > 0;
      const hasLetters = (value.match(/[A-Z]/g) ?? []).length >= 3;
      return hasTax && hasAmount && hasLetters && !/TOPKDV|TOPLAM|TUTAR/.test(value);
    });
  }

  if (start < 0) return { start: 0, end: 0 };

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const value = simplify(lines[index]);
    if (
      (value.includes('KDV') && value.includes('MATRAH')) ||
      /TOPKDV|TOP KDV|KDV TOPLAM|BRUT TOPLAM|ODENECEK|GENEL TOPLAM|INDIRIM TOPLAM|^TOPLAM\b/.test(value)
    ) {
      end = index;
      break;
    }
  }

  return { start, end };
}

function isLikelyProductDescription(line: string) {
  const normalized = simplify(line);
  if (!normalized || normalized.length < 3 || normalized.length > 110) return false;
  if (/(TOPLAM|KDV|VERGI|TUTAR|FATURA|VKN|TCKN|TARIH|SAAT|ETTN|MERSIS|KREDI|NAKIT|BANKA|REF|MAIL|E-POSTA|WWW|HTTP|PUAN)/.test(normalized)) return false;
  if (/\b\d{8,14}\b/.test(normalized)) return false;
  const letters = (normalized.match(/[A-Z]/g) ?? []).length;
  const decimals = extractDecimalAmounts(line).length;
  return letters >= 3 && decimals <= 1;
}

function cleanDescription(line: string) {
  let value = line
    .replace(/^\s*\d+\s+/, '')
    .replace(/\b\d{8,14}\b/g, ' ')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:ADET|AD\.?|PKT|PAKET|KG|GR|LT|ML)\b/gi, ' ')
    .replace(/%\s*0?(?:1|10|20)\b/g, ' ')
    .replace(/\d{1,3}(?:\.\d{3})*[.,]\d{2}\s*(?:TL|TRY|₺)?/gi, ' ')
    .replace(/[>*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-:|]+|[-:|]+$/g, '')
    .trim();

  const parts = value.split(/\s+/).filter(Boolean);
  const protectedShortWords = new Set(['SU', 'ET', 'UN']);
  if (
    parts.length >= 3 &&
    /^[A-Za-zÇĞİÖŞÜçğıöşü]{1,2}$/.test(parts[0]) &&
    !protectedShortWords.has(simplify(parts[0]))
  ) {
    parts.shift();
    value = parts.join(' ');
  }

  return normalizeCommonReceiptTerm(value.trim());
}

function detectItems(lines: string[]) {
  const region = findItemRegion(lines);
  if (region.end <= region.start) return [];

  const scoped = lines.slice(region.start, region.end);
  const items: ExtractedLineItem[] = [];
  const usedDescriptions = new Set<number>();

  for (let index = 0; index < scoped.length; index += 1) {
    const line = scoped[index];
    const normalizedLine = simplify(line);
    if (/(TOPLAM|TOPKDV|KDV|VERGI|ODENECEK|FATURA|VKN|TCKN|TARIH|SAAT|ETTN|MERSIS|NAKIT|KREDI|POS|BANKA|PUAN)/.test(normalizedLine)) continue;

    const amountTokens = line.match(/\d{1,3}(?:\.\d{3})*[.,]\d{2}|\d+[.,]\d{2}/g) ?? [];
    if (!amountTokens.length) continue;

    const hasBarcode = /\b\d{8,14}\b/.test(line);
    const taxMatch = normalizedLine.match(/%\s*0?(1|10|20)\b/);
    const quantityMatch = normalizedLine.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:ADET|AD\.?|PKT|PAKET|X|\*)\b/i);
    if (!hasBarcode && !taxMatch && !quantityMatch && amountTokens.length < 2) continue;

    const total = parseMoney(amountTokens[amountTokens.length - 1]);
    if (total <= 0 || total > 100_000) continue;

    const quantity = quantityMatch ? parseMoney(quantityMatch[1]) || 1 : 1;
    const taxRate = taxMatch ? Number(taxMatch[1]) : null;

    let description = cleanDescription(line);

    for (const neighborIndex of [index + 1, index - 1]) {
      if (neighborIndex < 0 || neighborIndex >= scoped.length || usedDescriptions.has(neighborIndex)) continue;
      const neighbor = scoped[neighborIndex];
      if (!isLikelyProductDescription(neighbor)) continue;

      const neighborDescription = cleanDescription(neighbor);
      const currentLetters = (description.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length;
      const neighborLetters = (neighborDescription.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length;
      if (hasBarcode || neighborLetters > currentLetters + 2) {
        description = neighborDescription;
        usedDescriptions.add(neighborIndex);
        break;
      }
    }

    if (!description || (description.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) ?? []).length < 2) continue;

    const unitPrice = amountTokens.length >= 2
      ? parseMoney(amountTokens[amountTokens.length - 2])
      : quantity > 0
        ? total / quantity
        : total;

    items.push({
      description,
      quantity,
      unitPrice: roundMoney(unitPrice || total),
      taxRate,
      total: roundMoney(total),
    });

    if (items.length >= 30) break;
  }

  const unique = new Map<string, ExtractedLineItem>();
  for (const item of items) {
    const key = `${simplify(item.description)}-${item.total.toFixed(2)}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

function detectVatBreakdown(lines: string[]): ExtractedTaxBreakdown[] {
  const region = findItemRegion(lines);
  let start = region.end > region.start ? region.end : 0;

  const explicitHeader = lines.findIndex((line, index) => {
    if (index < start) return false;
    const value = simplify(line);
    return value.includes('KDV') && value.includes('MATRAH');
  });
  if (explicitHeader >= 0) start = explicitHeader + 1;

  const rows: ExtractedTaxBreakdown[] = [];
  for (let index = start; index < Math.min(lines.length, start + 14); index += 1) {
    const normalized = simplify(lines[index]);
    if (/TOPKDV|TOP KDV|KDV TOPLAM|BRUT TOPLAM|ODENECEK|GENEL TOPLAM|INDIRIM TOPLAM/.test(normalized)) break;

    const rateMatch = normalized.match(/%\s*0?(1|10|20)\b/);
    if (!rateMatch) continue;

    const amounts = extractDecimalAmounts(lines[index]);
    if (amounts.length < 2) continue;

    const rate = Number(rateMatch[1]);
    const base = amounts[amounts.length - 2];
    const tax = amounts[amounts.length - 1];
    const expectedTax = base * rate / 100;
    const tolerance = Math.max(0.22, expectedTax * 0.08);
    if (Math.abs(tax - expectedTax) > tolerance) continue;

    rows.push({ rate, base: roundMoney(base), tax: roundMoney(tax) });
  }

  return rows;
}

function deriveVatBreakdownFromItems(items: ExtractedLineItem[]): ExtractedTaxBreakdown[] {
  const groups = new Map<number, { gross: number; count: number }>();
  for (const item of items) {
    if (item.taxRate == null || ![1, 10, 20].includes(item.taxRate) || item.total <= 0) continue;
    const current = groups.get(item.taxRate) ?? { gross: 0, count: 0 };
    current.gross += item.total;
    current.count += 1;
    groups.set(item.taxRate, current);
  }

  return [...groups.entries()]
    .map(([rate, group]) => {
      const base = group.gross / (1 + rate / 100);
      const tax = group.gross - base;
      return { rate, base: roundMoney(base), tax: roundMoney(tax) };
    })
    .sort((a, b) => a.rate - b.rate);
}

function sumBreakdown(rows: ExtractedTaxBreakdown[]) {
  return rows.reduce(
    (acc, row) => ({ base: acc.base + row.base, tax: acc.tax + row.tax }),
    { base: 0, tax: 0 },
  );
}

function detectDocumentType(text: string): ExtractedDocument['documentType'] {
  const normalized = simplify(text);
  if (/E-?ARSIV FATURA|E-?FATURA|FATURA NO|FATURANO|TEMELFATURA|TICARIFATURA/.test(normalized)) return 'invoice';
  if (/FIS\s*(?:NO|N0)|YAZAR KASA|PERAKENDE SATIS|TOPKDV/.test(normalized)) return 'receipt';
  return 'unknown';
}

function detectDocumentNumber(lines: string[], text: string, documentType: ExtractedDocument['documentType']) {
  if (documentType === 'receipt') {
    for (let index = 0; index < lines.length; index += 1) {
      const normalized = simplify(lines[index]);
      const match = normalized.match(/\bFIS\s*(?:NO|N0|NUMARASI)?\s*[:#-]?\s*([A-Z0-9\/-]{2,16})\b/);
      if (match?.[1] && !/^(?:NO|N0)$/.test(match[1])) return match[1];

      if (/\bFIS\s*(?:NO|N0|NUMARASI)?\b/.test(normalized)) {
        const next = simplify(lines[index + 1] ?? '');
        const nextMatch = next.match(/^([A-Z0-9\/-]{2,16})\b/);
        if (nextMatch?.[1]) return nextMatch[1];
      }
    }
    return EMPTY_VALUE;
  }

  const simplifiedText = simplify(text);
  return firstMatch(simplifiedText, [
    /(?:FATURA\s*(?:NO|NUMARASI|N0)|FATURANO)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\/-]{8,30})/i,
    /\b([A-Z]{1,5}\d{10,22})\b/,
  ]);
}

function detectEttn(text: string) {
  return firstMatch(text, [
    /(?:ETTN|UUID)\s*[:#-]?\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i,
  ]);
}

function detectCurrency(text: string) {
  const normalized = simplify(text);
  if (/\bEUR\b|\bEURO\b/.test(normalized)) return 'EUR';
  if (/\bUSD\b|\bUS DOLLAR\b|\bDOLAR\b/.test(normalized)) return 'USD';
  if (/\bGBP\b|\bSTERLIN\b/.test(normalized)) return 'GBP';
  return 'TRY';
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
    ? Math.abs(document.subtotal + document.taxTotal - document.total) <= 0.3
    : false;
  const itemGross = roundMoney(document.items.reduce((sum, item) => sum + item.total, 0));
  const itemConsistency = itemGross > 0 && document.total > 0 && amountsClose(itemGross, document.total, 0.025, 1) ? 1 : 0.55;
  const consistency = arithmeticMatches ? 1 : document.total > 0 ? 0.55 : 0.25;

  return Math.max(
    0.25,
    Math.min(0.99, ocrConfidence * 0.34 + coverage * 0.34 + consistency * 0.2 + itemConsistency * 0.12),
  );
}

export function parseInvoiceText(input: ParserInput, ocr: OcrResult): ExtractedDocument {
  const text = normalize(ocr.text);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const searchText = text.replace(/\n/g, ' ');
  const simplifiedSearchText = simplify(searchText);

  const documentType = detectDocumentType(searchText);
  const supplierTaxNumber = detectTaxNumber(simplifiedSearchText);
  const invoiceNumber = detectDocumentNumber(lines, searchText, documentType);
  const invoiceDate = detectDate(lines, searchText);
  const ettn = detectEttn(searchText);
  const items = detectItems(lines);

  const detectedBreakdown = detectVatBreakdown(lines);
  const derivedBreakdown = deriveVatBreakdownFromItems(items);
  const detectedVat = sumBreakdown(detectedBreakdown);
  const derivedVat = sumBreakdown(derivedBreakdown);

  const labeledTotal = findAmountByLabels(lines, [
    'ÖDENECEK KDV DAHİL TUTAR',
    'ODENECEK KDV DAHIL TUTAR',
    'ÖDENECEK TUTAR',
    'ODENECEK TUTAR',
    'BRÜT TOPLAM',
    'BRUT TOPLAM',
    'GENEL TOPLAM',
    'VERGİLER DAHİL TOPLAM',
    'VERGILER DAHIL TOPLAM',
  ]);
  const receiptTotal = documentType === 'receipt' ? findReceiptTotal(lines) : 0;
  const repeatedAmount = detectRepeatedAmount(lines);
  const itemGross = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const detectedVatGross = roundMoney(detectedVat.base + detectedVat.tax);

  const total = chooseConsensusAmount([
    { value: labeledTotal, weight: 3.5 },
    { value: receiptTotal, weight: receiptTotal > 0 ? 4.5 : 0 },
    { value: repeatedAmount, weight: 3 },
    { value: itemGross, weight: items.length ? 4 : 0 },
    { value: detectedVatGross, weight: detectedBreakdown.length ? 4.5 : 0 },
  ]);

  const labeledTaxTotal = findAmountByLabels(lines, [
    'TOPKDV',
    'TOP KDV',
    'KDV TOPLAM',
    'KDV TOPLAMI',
    'HESAPLANAN KDV',
    'TOPLAM KDV',
    'VERGİ TOPLAMI',
  ]);

  const taxTotal = chooseConsensusAmount([
    { value: labeledTaxTotal, weight: labeledTaxTotal > 0 ? 4 : 0 },
    { value: detectedVat.tax, weight: detectedBreakdown.length ? 5 : 0 },
    { value: derivedVat.tax, weight: derivedBreakdown.length ? 4 : 0 },
  ]);

  const preferredBreakdown = detectedBreakdown.length
    ? detectedBreakdown
    : derivedBreakdown;

  const preferredVat = sumBreakdown(preferredBreakdown);
  const labeledSubtotal = findAmountByLabels(lines, [
    'MAL / HİZMET TOPLAMI',
    'MAL HİZMET TOPLAMI',
    'ARA TOPLAM',
  ]);
  const computedSubtotal = total > 0 && taxTotal > 0 ? roundMoney(total - taxTotal) : 0;
  const subtotal = chooseConsensusAmount([
    { value: labeledSubtotal, weight: 2 },
    { value: preferredVat.base, weight: preferredBreakdown.length ? 4.5 : 0 },
    { value: computedSubtotal, weight: computedSubtotal > 0 ? 4.5 : 0 },
  ]);

  const paymentMethod = /KREDI\s*KARTI|CREDIT\s*CARD|BANKA\s*KARTI|CARD|\bKREDI\b/i.test(simplifiedSearchText)
    ? 'Kredi Kartı'
    : /NAKIT|CASH/i.test(simplifiedSearchText)
      ? 'Nakit'
      : EMPTY_VALUE;

  const baseDocument: Omit<ExtractedDocument, 'confidence'> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    source: input.source,
    sourceUri: input.uri,
    fileName: input.name,
    mimeType: input.mimeType,
    documentType,
    supplierName: detectSupplier(lines),
    supplierTaxNumber,
    invoiceNumber,
    invoiceDate,
    ettn: ettn || undefined,
    currency: detectCurrency(searchText),
    subtotal,
    taxTotal,
    taxBreakdown: preferredBreakdown.length ? preferredBreakdown : undefined,
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
