import AsyncStorage from '@react-native-async-storage/async-storage';

import { ExtractedDocument } from '../types/document';

const STORAGE_KEY = 'read-fatura.documents';
const MAX_DOCUMENTS = 500;

export async function getDocuments(): Promise<ExtractedDocument[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExtractedDocument[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveDocument(document: ExtractedDocument) {
  const current = await getDocuments();
  const next = [document, ...current.filter((item) => item.id !== document.id)].slice(0, MAX_DOCUMENTS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function saveDocuments(documents: ExtractedDocument[]) {
  const current = await getDocuments();
  const ids = new Set(documents.map((item) => item.id));
  const next = [...documents, ...current.filter((item) => !ids.has(item.id))].slice(0, MAX_DOCUMENTS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function deleteDocument(id: string) {
  const current = await getDocuments();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current.filter((item) => item.id !== id)));
}
