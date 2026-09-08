import { OcrError, OcrInput, OcrProgressCallback, OcrResult } from './types';

export async function recognizeDocument(
  _input: OcrInput,
  _onProgress?: OcrProgressCallback,
): Promise<OcrResult> {
  throw new OcrError(
    'unsupported-native',
    'On-device OCR requires a development build. Expo Go cannot load custom native OCR modules.',
  );
}
