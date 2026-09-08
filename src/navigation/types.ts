import { ExtractedDocument } from '../types/document';

export type DocumentInputParams = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  source: 'camera' | 'file';
};

export type RootStackParamList = {
  Home: undefined;
  Scanner: undefined;
  Review: DocumentInputParams;
  Analysis: DocumentInputParams;
  Result: {
    document: ExtractedDocument;
    origin?: 'analysis' | 'archive';
  };
};
