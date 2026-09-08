export type DocumentSource = 'camera' | 'file';

export type ExtractedLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number | null;
  total: number;
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
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  items: ExtractedLineItem[];
  confidence: number;
  engine: 'demo';
};
