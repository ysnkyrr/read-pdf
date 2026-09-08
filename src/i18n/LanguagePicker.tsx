import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { MoonPressable } from '../moonlinea/components/MoonPressable';
import { MoonText } from '../moonlinea/components/MoonText';
import { moonColors, moonRadius, moonSpacing } from '../moonlinea/theme/tokens';
import { getCurrentLanguage, setAppLanguage, SupportedLanguage } from './index';

const languages: Array<{ code: SupportedLanguage; label: string }> = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'zh-CN', label: '简体中文' },
];

const titles: Record<SupportedLanguage, string> = {
  tr: 'Dil',
  en: 'Language',
  es: 'Idioma',
  pt: 'Idioma',
  fr: 'Langue',
  de: 'Sprache',
  ar: 'اللغة',
  ru: 'Язык',
  hi: 'भाषा',
  id: 'Bahasa',
  'zh-CN': '语言',
};

const closeLabels: Record<SupportedLanguage, string> = {
  tr: 'Kapat',
  en: 'Close',
  es: 'Cerrar',
  pt: 'Fechar',
  fr: 'Fermer',
  de: 'Schließen',
  ar: 'إغلاق',
  ru: 'Закрыть',
  hi: 'बंद करें',
  id: 'Tutup',
  'zh-CN': '关闭',
};

export function LanguagePicker() {
  useTranslation();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const current = getCurrentLanguage();
  const currentLabel = languages.find((item) => item.code === current)?.label ?? 'Türkçe';

  const selectLanguage = async (language: SupportedLanguage) => {
    if (changing) return;
    setChanging(true);
    try {
      await setAppLanguage(language);
      setOpen(false);
    } finally {
      setChanging(false);
    }
  };

  return (
    <>
      <MoonPressable
        onPress={() => setOpen(true)}
        style={styles.trigger}
        accessibilityLabel={`${titles[current]}: ${currentLabel}`}
      >
        <MoonText style={styles.globe}>◉</MoonText>
        <MoonText style={styles.triggerText}>{currentLabel}</MoonText>
        <MoonText style={styles.chevron}>⌄</MoonText>
      </MoonPressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityRole="button" />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <MoonText style={styles.sheetTitle}>{titles[current]}</MoonText>
              <MoonPressable
                onPress={() => setOpen(false)}
                style={styles.closeButton}
                accessibilityLabel={closeLabels[current]}
                haptic={false}
              >
                <MoonText style={styles.closeText}>×</MoonText>
              </MoonPressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {languages.map((language) => {
                const selected = language.code === current;
                return (
                  <MoonPressable
                    key={language.code}
                    onPress={() => void selectLanguage(language.code)}
                    disabled={changing}
                    style={[styles.languageRow, selected && styles.languageRowSelected]}
                    accessibilityLabel={language.label}
                    accessibilityState={{ selected }}
                  >
                    <MoonText style={[styles.languageLabel, selected && styles.languageLabelSelected]}>
                      {language.label}
                    </MoonText>
                    <MoonText style={styles.languageCode}>{language.code.toUpperCase()}</MoonText>
                    {selected ? <MoonText style={styles.check}>✓</MoonText> : null}
                  </MoonPressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 40,
    paddingHorizontal: moonSpacing[3],
    borderRadius: moonRadius.pill,
    borderWidth: 1,
    borderColor: moonColors.border,
    backgroundColor: moonColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: moonSpacing[2],
  },
  globe: { color: moonColors.accent, fontSize: 13, fontWeight: '800' },
  triggerText: { color: moonColors.textPrimary, fontSize: 13, fontWeight: '700' },
  chevron: { color: moonColors.textSecondary, fontSize: 15, marginTop: -2 },
  modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: moonSpacing[5] },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: moonColors.overlay },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: moonRadius.large,
    backgroundColor: moonColors.surface,
    padding: moonSpacing[5],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moonSpacing[4],
  },
  sheetTitle: { color: moonColors.textPrimary, fontSize: 20, fontWeight: '800' },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: moonRadius.pill,
    backgroundColor: moonColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: moonColors.textPrimary, fontSize: 24, lineHeight: 26 },
  list: { gap: moonSpacing[2] },
  languageRow: {
    minHeight: 50,
    paddingHorizontal: moonSpacing[4],
    borderRadius: moonRadius.medium,
    backgroundColor: moonColors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageRowSelected: {
    backgroundColor: '#EAF0FF',
    borderWidth: 1,
    borderColor: '#C8D6FF',
  },
  languageLabel: { flex: 1, color: moonColors.textPrimary, fontSize: 15, fontWeight: '600' },
  languageLabelSelected: { fontWeight: '800' },
  languageCode: { color: moonColors.textSecondary, fontSize: 11, fontWeight: '700', marginRight: moonSpacing[3] },
  check: { color: moonColors.accent, fontSize: 17, fontWeight: '800' },
});
