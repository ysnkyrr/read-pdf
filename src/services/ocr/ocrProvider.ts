import { OcrError, OcrInput, OcrProgressCallback, OcrResult } from './types';

export async function recognizeDocument(
  _input: OcrInput,
  _onProgress?: OcrProgressCallback,
): Promise<OcrResult> {
  throw new OcrError('read-failed', 'OCR provider is unavailable on this platform.');
}
