import { applyCorrectionMemory } from './correctionMemory';
import { parseInvoiceText } from './invoiceParser';
import { OcrProgress, recognizeDocument } from './ocr';
import { refineReceiptExtraction } from './receiptRefiner';
import { ExtractedDocument } from '../types/document';

type AnalyzeInput = {
  uri: string;
  name: string;
  mimeType?: string | null;
  source: 'camera' | 'file';
};

type AnalyzeOptions = {
  onProgress?: (progress: OcrProgress) => void;
};

export async function analyzeDocument(
  input: AnalyzeInput,
  options: AnalyzeOptions = {},
): Promise<ExtractedDocument> {
  const ocr = await recognizeDocument(
    {
      uri: input.uri,
      name: input.name,
      mimeType: input.mimeType,
    },
    options.onProgress,
  );

  options.onProgress?.({ stage: 'finalizing', progress: 0.98 });
  const parsed = refineReceiptExtraction(parseInvoiceText(input, ocr));
  return applyCorrectionMemory(parsed);
}
