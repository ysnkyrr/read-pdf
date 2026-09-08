import { ExtractedDocument } from '../types/document';

type AnalyzeInput = {
  uri: string;
  name: string;
  mimeType?: string | null;
  source: 'camera' | 'file';
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function analyzeDocument(input: AnalyzeInput): Promise<ExtractedDocument> {
  // Development adapter. This contract will be replaced by the secure OCR/AI backend
  // without changing the screens that consume structured invoice data.
  await wait(900);

  const isSampleInvoice = input.name.toLowerCase().includes('ornek_e_fatura_test');

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    source: input.source,
    sourceUri: input.uri,
    fileName: input.name,
    mimeType: input.mimeType,
    documentType: 'invoice',
    supplierName: isSampleInvoice ? 'Moonlinea Test Teknoloji Ltd. Şti.' : 'Örnek Satıcı Ltd. Şti.',
    supplierTaxNumber: isSampleInvoice ? '1234567890' : '0000000000',
    invoiceNumber: isSampleInvoice ? 'MLN202600000124' : 'TEST-000001',
    invoiceDate: isSampleInvoice ? '08.09.2026' : new Date().toLocaleDateString('tr-TR'),
    currency: 'TRY',
    subtotal: isSampleInvoice ? 2500 : 1000,
    taxTotal: isSampleInvoice ? 500 : 200,
    total: isSampleInvoice ? 3000 : 1200,
    paymentMethod: isSampleInvoice ? 'Kredi Kartı' : 'Belirtilmedi',
    items: isSampleInvoice
      ? [
          { description: 'Belge Tarama Aboneliği', quantity: 1, unitPrice: 1250, taxRate: 20, total: 1250 },
          { description: 'OCR İşlem Paketi', quantity: 2, unitPrice: 375, taxRate: 20, total: 750 },
          { description: 'Arşivleme Hizmeti', quantity: 1, unitPrice: 500, taxRate: 20, total: 500 },
        ]
      : [{ description: 'Örnek ürün / hizmet', quantity: 1, unitPrice: 1000, taxRate: 20, total: 1000 }],
    confidence: isSampleInvoice ? 0.96 : 0.72,
    engine: 'demo',
  };
}
