import { OcrError, OcrInput, OcrProgressCallback, OcrResult } from './types';

export async function recognizeDocument(
  input: OcrInput,
  onProgress?: OcrProgressCallback,
): Promise<OcrResult> {
  const isPdf = input.mimeType === 'application/pdf' || input.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    throw new OcrError('read-failed', 'Mobile PDF OCR is not enabled yet. Use an image or the web app for PDFs.');
  }

  onProgress?.({ stage: 'loading', progress: 0.1 });

  try {
    const { recognizeText } = await import('expo-ocr-kit');
    onProgress?.({ stage: 'reading', progress: 0.42 });
    const result = await recognizeText(input.uri);
    const text = result.text?.trim() ?? '';
    if (!text) throw new OcrError('empty-text', 'No readable text was found in the image.');

    onProgress?.({ stage: 'finalizing', progress: 0.94 });
    return {
      text,
      confidence: text.length >= 80 ? 0.86 : text.length >= 30 ? 0.74 : 0.58,
      engine: 'native-ocr',
      pageCount: 1,
    };
  } catch (error) {
    if (error instanceof OcrError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/native module|cannot find native|not found|expo go|requireNativeModule/i.test(message)) {
      throw new OcrError(
        'unsupported-native',
        'On-device OCR requires a development build. Expo Go cannot load custom native OCR modules.',
      );
    }
    throw new OcrError('read-failed', message || 'Native OCR failed.');
  }
}
