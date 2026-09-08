import { OcrError, OcrInput, OcrProgressCallback, OcrResult } from './types';

const PDF_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build/pdf.worker.min.mjs';
const MAX_PDF_PAGES = 6;
const MIN_NATIVE_TEXT_CHARS = 40;

type WorkerLike = {
  recognize: (image: unknown) => Promise<{ data: { text?: string; confidence?: number } }>;
  terminate: () => Promise<unknown>;
};

async function getBlob(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new OcrError('read-failed', 'The selected document could not be opened.');
  return response.blob();
}

function cleanText(text: string) {
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function recognizeDocument(
  input: OcrInput,
  onProgress?: OcrProgressCallback,
): Promise<OcrResult> {
  onProgress?.({ stage: 'loading', progress: 0.04 });

  const blob = await getBlob(input.uri);
  const isPdf = input.mimeType === 'application/pdf' || input.name.toLowerCase().endsWith('.pdf');
  let worker: WorkerLike | null = null;

  const ensureWorker = async () => {
    if (worker) return worker;
    const { createWorker } = await import('tesseract.js');
    worker = (await createWorker(['tur', 'eng'], 1, {
      logger: (message: { status?: string; progress?: number }) => {
        if (message.status === 'recognizing text') {
          onProgress?.({ stage: 'reading', progress: 0.15 + (message.progress ?? 0) * 0.68 });
        }
      },
    })) as unknown as WorkerLike;
    return worker;
  };

  try {
    if (!isPdf) {
      const ocrWorker = await ensureWorker();
      const result = await ocrWorker.recognize(blob);
      const text = cleanText(result.data.text ?? '');
      if (!text) throw new OcrError('empty-text', 'No readable text was found in the image.');

      onProgress?.({ stage: 'finalizing', progress: 0.94 });
      return {
        text,
        confidence: Math.max(0, Math.min(1, (result.data.confidence ?? 70) / 100)),
        engine: 'tesseract-web',
        pageCount: 1,
      };
    }

    const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as any;
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

    const data = new Uint8Array(await blob.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pageTexts: string[] = [];
    const confidences: number[] = [];
    let usedPdfText = false;
    let usedOcr = false;

    for (let index = 1; index <= pageCount; index += 1) {
      onProgress?.({ stage: 'reading', progress: 0.12 + ((index - 1) / Math.max(1, pageCount)) * 0.7 });
      const page = await pdf.getPage(index);
      const textContent = await page.getTextContent();
      const nativeText = cleanText(
        textContent.items
          .map((item: { str?: string; hasEOL?: boolean }) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`)
          .join(''),
      );

      if (nativeText.replace(/\s/g, '').length >= MIN_NATIVE_TEXT_CHARS) {
        pageTexts.push(nativeText);
        confidences.push(0.99);
        usedPdfText = true;
        continue;
      }

      const viewport = page.getViewport({ scale: 2.15 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new OcrError('read-failed', 'The PDF page could not be rendered.');

      await page.render({ canvasContext: context, viewport, canvas }).promise;
      const ocrWorker = await ensureWorker();
      const result = await ocrWorker.recognize(canvas);
      const pageText = cleanText(result.data.text ?? '');
      if (pageText) {
        pageTexts.push(pageText);
        confidences.push(Math.max(0, Math.min(1, (result.data.confidence ?? 68) / 100)));
        usedOcr = true;
      }
    }

    const text = cleanText(pageTexts.join('\n\n'));
    if (!text) throw new OcrError('empty-text', 'No readable text was found in the PDF.');

    onProgress?.({ stage: 'finalizing', progress: 0.94 });
    return {
      text,
      confidence: confidences.length
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
        : 0.65,
      engine: usedPdfText && usedOcr ? 'mixed-web' : usedPdfText ? 'pdf-text' : 'tesseract-web',
      pageCount,
    };
  } catch (error) {
    if (error instanceof OcrError) throw error;
    throw new OcrError('read-failed', error instanceof Error ? error.message : 'OCR failed.');
  } finally {
    if (worker) await worker.terminate().catch(() => undefined);
  }
}
