import AsyncStorage from '@react-native-async-storage/async-storage';

import { ExtractedDocument } from '../types/document';

const STORAGE_KEY = 'read-fatura.correction-memory.v1';

type SupplierMemory = Record<string, { name: string; updatedAt: string }>;
type ItemMemory = Record<string, { description: string; updatedAt: string }>;

type CorrectionMemory = {
  suppliers: SupplierMemory;
  items: ItemMemory;
};

const EMPTY_MEMORY: CorrectionMemory = { suppliers: {}, items: {} };

function normalizeKey(value: string) {
  return value
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readMemory(): Promise<CorrectionMemory> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_MEMORY;
    const parsed = JSON.parse(raw) as Partial<CorrectionMemory>;
    return {
      suppliers: parsed.suppliers ?? {},
      items: parsed.items ?? {},
    };
  } catch {
    return EMPTY_MEMORY;
  }
}

async function writeMemory(memory: CorrectionMemory) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

export async function applyCorrectionMemory(document: ExtractedDocument) {
  const memory = await readMemory();
  const supplier = document.supplierTaxNumber
    ? memory.suppliers[document.supplierTaxNumber]
    : undefined;

  const items = document.items.map((item) => {
    const alias = memory.items[normalizeKey(item.description)];
    return alias ? { ...item, description: alias.description } : item;
  });

  return {
    ...document,
    supplierName: supplier?.name || document.supplierName,
    items,
  };
}

export async function learnFromCorrection(original: ExtractedDocument, corrected: ExtractedDocument) {
  const memory = await readMemory();
  const now = new Date().toISOString();

  if (corrected.supplierTaxNumber && corrected.supplierName.trim()) {
    memory.suppliers[corrected.supplierTaxNumber] = {
      name: corrected.supplierName.trim(),
      updatedAt: now,
    };
  }

  const length = Math.min(original.items.length, corrected.items.length);
  for (let index = 0; index < length; index += 1) {
    const before = original.items[index]?.description?.trim();
    const after = corrected.items[index]?.description?.trim();
    if (!before || !after || normalizeKey(before) === normalizeKey(after)) continue;
    memory.items[normalizeKey(before)] = { description: after, updatedAt: now };
  }

  await writeMemory(memory);
}
