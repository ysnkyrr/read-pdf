import { ExtractedDocument } from '../types/document';

export type ValidationCode =
  | 'missing-supplier'
  | 'missing-number'
  | 'missing-date'
  | 'missing-total'
  | 'total-mismatch'
  | 'items-mismatch'
  | 'low-confidence';

export type ValidationIssue = {
  code: ValidationCode;
  severity: 'warning' | 'error';
};

function closeTo(a: number, b: number, tolerance = 0.75) {
  return Math.abs(a - b) <= tolerance;
}

export function validateDocument(document: ExtractedDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!document.supplierName.trim()) issues.push({ code: 'missing-supplier', severity: 'warning' });
  if (!document.invoiceNumber.trim()) issues.push({ code: 'missing-number', severity: 'warning' });
  if (!document.invoiceDate.trim()) issues.push({ code: 'missing-date', severity: 'warning' });
  if (document.total <= 0) issues.push({ code: 'missing-total', severity: 'error' });

  if (
    document.total > 0 &&
    document.subtotal > 0 &&
    document.taxTotal >= 0 &&
    !closeTo(document.subtotal + document.taxTotal, document.total)
  ) {
    issues.push({ code: 'total-mismatch', severity: 'error' });
  }

  const itemTotal = document.items.reduce((sum, item) => sum + (Number.isFinite(item.total) ? item.total : 0), 0);
  if (document.items.length > 0 && document.total > 0 && !closeTo(itemTotal, document.total, Math.max(1, document.total * 0.035))) {
    issues.push({ code: 'items-mismatch', severity: 'warning' });
  }

  if (document.confidence < 0.72) issues.push({ code: 'low-confidence', severity: 'warning' });

  return issues;
}
