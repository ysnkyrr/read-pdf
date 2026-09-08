import { Platform, Share } from 'react-native';

import { ExtractedDocument } from '../types/document';

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function documentsToCsv(documents: ExtractedDocument[]) {
  const rows = [
    ['Tarih', 'Firma', 'VKN', 'Belge No', 'Belge Türü', 'Para Birimi', 'Matrah', 'KDV', 'Toplam', 'Ödeme'],
    ...documents.map((item) => [
      item.invoiceDate,
      item.supplierName,
      item.supplierTaxNumber,
      item.invoiceNumber,
      item.documentType,
      item.currency,
      item.subtotal.toFixed(2),
      item.taxTotal.toFixed(2),
      item.total.toFixed(2),
      item.paymentMethod,
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`;
}

export function documentsToJson(documents: ExtractedDocument[]) {
  return JSON.stringify(documents, null, 2);
}

function downloadWeb(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  globalThis.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportDocuments(
  documents: ExtractedDocument[],
  format: 'csv' | 'json',
) {
  const stamp = new Date().toISOString().slice(0, 10);
  const content = format === 'csv' ? documentsToCsv(documents) : documentsToJson(documents);
  const fileName = `read-fatura-${stamp}.${format}`;

  if (Platform.OS === 'web' && typeof globalThis.document !== 'undefined') {
    downloadWeb(
      content,
      fileName,
      format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    );
    return;
  }

  await Share.share({
    title: fileName,
    message: content,
  });
}
