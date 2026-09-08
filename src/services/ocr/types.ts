export type OcrEngine = 'tesseract-web' | 'pdf-text' | 'mixed-web' | 'native-ocr';

export type OcrStage = 'loading' | 'reading' | 'finalizing';

export type OcrProgress = {
  stage: OcrStage;
  progress: number;
};

export type OcrProgressCallback = (progress: OcrProgress) => void;

export type OcrInput = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export type OcrResult = {
  text: string;
  confidence: number;
  engine: OcrEngine;
  pageCount: number;
};

export class OcrError extends Error {
  code: 'unsupported-native' | 'empty-text' | 'read-failed';

  constructor(code: OcrError['code'], message: string) {
    super(message);
    this.name = 'OcrError';
    this.code = code;
  }
}
