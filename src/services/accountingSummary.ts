import { ExtractedDocument } from '../types/document';

export type VatSummaryRow = { rate: number; base: number; tax: number };
export type SupplierSummaryRow = { name: string; total: number; count: number };

export type AccountingSummary = {
  documentCount: number;
  grossTotal: number;
  taxTotal: number;
  netTotal: number;
  vat: VatSummaryRow[];
  suppliers: SupplierSummaryRow[];
};

function monthKeyFromDocument(document: ExtractedDocument) {
  const match = document.invoiceDate.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, '0')}`;
}

export function getDocumentMonthKeys(documents: ExtractedDocument[]) {
  return [...new Set(documents.map(monthKeyFromDocument).filter((value): value is string => Boolean(value)))].sort().reverse();
}

export function summarizeDocuments(documents: ExtractedDocument[], monthKey?: string | null): AccountingSummary {
  const selected = monthKey
    ? documents.filter((document) => monthKeyFromDocument(document) === monthKey)
    : documents;

  const vatMap = new Map<number, VatSummaryRow>();
  const supplierMap = new Map<string, SupplierSummaryRow>();

  for (const document of selected) {
    for (const row of document.taxBreakdown ?? []) {
      const current = vatMap.get(row.rate) ?? { rate: row.rate, base: 0, tax: 0 };
      current.base += row.base;
      current.tax += row.tax;
      vatMap.set(row.rate, current);
    }

    const supplierName = document.supplierName.trim() || '-';
    const supplier = supplierMap.get(supplierName) ?? { name: supplierName, total: 0, count: 0 };
    supplier.total += document.total;
    supplier.count += 1;
    supplierMap.set(supplierName, supplier);
  }

  const grossTotal = selected.reduce((sum, document) => sum + document.total, 0);
  const taxTotal = selected.reduce((sum, document) => sum + document.taxTotal, 0);

  return {
    documentCount: selected.length,
    grossTotal,
    taxTotal,
    netTotal: grossTotal - taxTotal,
    vat: [...vatMap.values()].sort((a, b) => a.rate - b.rate),
    suppliers: [...supplierMap.values()].sort((a, b) => b.total - a.total).slice(0, 12),
  };
}
