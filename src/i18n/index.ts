import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources, SupportedLanguage, supportedLanguages } from './resources';
import { workflowResources } from './workflowResources';

const LANGUAGE_STORAGE_KEY = 'read-fatura.language';
const DEFAULT_LANGUAGE: SupportedLanguage = 'tr';

const mergedResources = supportedLanguages.reduce((acc, language) => {
  acc[language] = {
    translation: {
      ...resources[language].translation,
      ...workflowResources[language].translation,
    },
  };
  return acc;
}, {} as Record<SupportedLanguage, { translation: Record<string, unknown> }>);

function normalizeLanguage(language?: string | null): SupportedLanguage {
  if (!language) return DEFAULT_LANGUAGE;

  const lower = language.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';

  const base = lower.split('-')[0] as SupportedLanguage;
  return supportedLanguages.includes(base) ? base : DEFAULT_LANGUAGE;
}

export async function initializeI18n() {
  const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const language = normalizeLanguage(saved ?? DEFAULT_LANGUAGE);

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: mergedResources,
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: supportedLanguages,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  } else if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  return language;
}

export async function setAppLanguage(language: SupportedLanguage) {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export function getCurrentLanguage(): SupportedLanguage {
  return normalizeLanguage(i18n.language);
}

export { DEFAULT_LANGUAGE };
export { supportedLanguages } from './resources';
export type { SupportedLanguage } from './resources';
export default i18n;
