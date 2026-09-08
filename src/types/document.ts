export type DocumentSource = 'camera' | 'file';

export type ExtractionEngine = 'tesseract-web' | 'pdf-text' | 'mixed-web' | 'native-ocr';

export type ExtractedLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number | null;
  total: number;
};

export type ExtractedTaxBreakdown = {
  rate: number;
  base: number;
  tax: number;
};

export type ExtractedDocument = {
  id: string;
  createdAt: string;
  source: DocumentSource;
  sourceUri: string;
  fileName: string;
  mimeType?: string | null;
  documentType: 'invoice' | 'receipt' | 'unknown';
  supplierName: string;
  supplierTaxNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  ettn?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  taxBreakdown?: ExtractedTaxBreakdown[];
  total: number;
  paymentMethod: string;
  items: ExtractedLineItem[];
  confidence: number;
  engine: ExtractionEngine;
  rawText?: string;
};
