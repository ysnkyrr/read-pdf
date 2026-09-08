import { parseInvoiceText } from './invoiceParser';
import { OcrProgress, recognizeDocument } from './ocr';
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
  return parseInvoiceText(input, ocr);
}
