import { useCallback, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LanguagePicker } from '../../i18n/LanguagePicker';
import { MoonButton } from '../../moonlinea/components/MoonButton';
import { MoonCard } from '../../moonlinea/components/MoonCard';
import { MoonText } from '../../moonlinea/components/MoonText';
import { moonColors, moonRadius, moonSpacing } from '../../moonlinea/theme/tokens';
import { getDocuments } from '../../services/documentStore';
import { ExtractedDocument } from '../../types/document';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getDocuments().then((items) => {
        if (active) setDocuments(items);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;
    const asset = result.assets[0];

    navigation.navigate('Review', {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      source: 'file',
    });
  };

  const formatMoney = (document: ExtractedDocument) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: document.currency }).format(document.total);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.brandIdentity}>
            <View style={styles.mark} accessibilityElementsHidden>
              <View style={styles.markInner} />
            </View>
            <MoonText style={styles.brand}>READ FATURA</MoonText>
          </View>
          <LanguagePicker />
        </View>

        <View style={styles.hero}>
          <MoonText style={styles.eyebrow}>{t('home.eyebrow')}</MoonText>
          <MoonText style={styles.title}>{t('home.title')}</MoonText>
          <MoonText style={styles.subtitle}>{t('home.subtitle')}</MoonText>
        </View>

        <MoonCard style={styles.actionCard}>
          <View style={styles.actionIcon}>
            <View style={styles.cameraBody}>
              <View style={styles.cameraLens} />
            </View>
          </View>
          <View style={styles.actionCopy}>
            <MoonText style={styles.actionTitle}>{t('home.scan')}</MoonText>
            <MoonText style={styles.actionHint}>{t('home.scanHint')}</MoonText>
          </View>
          <MoonButton label={t('home.scan')} onPress={() => navigation.navigate('Scanner')} />
        </MoonCard>

        <MoonCard onPress={pickDocument} accessibilityLabel={t('home.upload')} style={styles.uploadCard}>
          <View style={styles.uploadGlyph}>
            <View style={styles.fileSheet} />
            <View style={styles.fileLine} />
          </View>
          <View style={styles.uploadCopy}>
            <MoonText style={styles.uploadTitle}>{t('home.upload')}</MoonText>
            <MoonText style={styles.uploadHint}>{t('home.uploadHint')}</MoonText>
          </View>
          <MoonText style={styles.chevron}>›</MoonText>
        </MoonCard>

        <View style={styles.sectionHeader}>
          <MoonText style={styles.sectionTitle}>{t('home.recentTitle')}</MoonText>
        </View>

        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <View style={styles.emptySheet} />
            </View>
            <MoonText style={styles.emptyTitle}>{t('home.emptyTitle')}</MoonText>
            <MoonText style={styles.emptyBody}>{t('home.emptyBody')}</MoonText>
          </View>
        ) : (
          <View style={styles.recentList}>
            {documents.slice(0, 5).map((document) => (
              <MoonCard
                key={document.id}
                onPress={() => navigation.navigate('Result', { document, origin: 'archive' })}
                accessibilityLabel={`${document.supplierName}, ${document.invoiceNumber}`}
                style={styles.recentCard}
              >
                <View style={styles.recentIcon}>
                  <View style={styles.recentSheet} />
                </View>
                <View style={styles.recentCopy}>
                  <MoonText style={styles.recentSupplier} numberOfLines={1}>{document.supplierName}</MoonText>
                  <MoonText style={styles.recentMeta} numberOfLines={1}>{document.invoiceNumber} · {document.invoiceDate}</MoonText>
                </View>
                <View style={styles.recentAmountWrap}>
                  <MoonText style={styles.recentAmount}>{formatMoney(document)}</MoonText>
                  <MoonText style={styles.recentChevron}>›</MoonText>
                </View>
              </MoonCard>
            ))}
          </View>
        )}

        <MoonText style={styles.privacy}>{t('home.privacy')}</MoonText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: moonColors.background },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: moonSpacing[5],
    paddingTop: moonSpacing[4],
    paddingBottom: moonSpacing[12],
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: moonSpacing[3],
    marginBottom: moonSpacing[10],
  },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: moonSpacing[3], flexShrink: 1 },
  mark: { width: 30, height: 30, borderRadius: 10, backgroundColor: moonColors.textPrimary, alignItems: 'center', justifyContent: 'center' },
  markInner: { width: 10, height: 14, borderWidth: 2, borderColor: moonColors.primaryText, borderRadius: 2 },
  brand: { color: moonColors.textPrimary, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  hero: { marginBottom: moonSpacing[8] },
  eyebrow: { color: moonColors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: moonSpacing[3] },
  title: { color: moonColors.textPrimary, fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1.5, marginBottom: moonSpacing[4] },
  subtitle: { color: moonColors.textSecondary, fontSize: 17, lineHeight: 26, maxWidth: 580 },
  actionCard: { marginBottom: moonSpacing[4], padding: moonSpacing[6] },
  actionIcon: { width: 50, height: 50, borderRadius: moonRadius.medium, backgroundColor: moonColors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: moonSpacing[5] },
  cameraBody: { width: 25, height: 18, borderWidth: 2, borderColor: moonColors.textPrimary, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  cameraLens: { width: 7, height: 7, borderRadius: 4, borderWidth: 2, borderColor: moonColors.textPrimary },
  actionCopy: { marginBottom: moonSpacing[5] },
  actionTitle: { color: moonColors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: moonSpacing[2] },
  actionHint: { color: moonColors.textSecondary, fontSize: 15, lineHeight: 22 },
  uploadCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: moonSpacing[4], marginBottom: moonSpacing[8] },
  uploadGlyph: { width: 42, height: 42, borderRadius: 13, backgroundColor: moonColors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: moonSpacing[3] },
  fileSheet: { width: 17, height: 22, borderRadius: 2, borderWidth: 1.5, borderColor: moonColors.textPrimary },
  fileLine: { width: 8, height: 1.5, backgroundColor: moonColors.textPrimary, position: 'absolute', bottom: 14 },
  uploadCopy: { flex: 1 },
  uploadTitle: { color: moonColors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  uploadHint: { color: moonColors.textSecondary, fontSize: 13 },
  chevron: { color: moonColors.textSecondary, fontSize: 28, lineHeight: 30 },
  sectionHeader: { marginBottom: moonSpacing[4] },
  sectionTitle: { color: moonColors.textPrimary, fontSize: 18, fontWeight: '800' },
  emptyState: { minHeight: 220, borderRadius: moonRadius.large, borderWidth: 1, borderStyle: 'dashed', borderColor: moonColors.border, alignItems: 'center', justifyContent: 'center', padding: moonSpacing[6] },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: moonColors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: moonSpacing[4] },
  emptySheet: { width: 16, height: 21, borderWidth: 1.5, borderColor: moonColors.textSecondary, borderRadius: 2 },
  emptyTitle: { color: moonColors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: moonSpacing[2] },
  emptyBody: { color: moonColors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  recentList: { gap: moonSpacing[3] },
  recentCard: { flexDirection: 'row', alignItems: 'center', padding: moonSpacing[4] },
  recentIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: moonColors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: moonSpacing[3] },
  recentSheet: { width: 16, height: 21, borderWidth: 1.5, borderColor: moonColors.textSecondary, borderRadius: 2 },
  recentCopy: { flex: 1, minWidth: 0 },
  recentSupplier: { color: moonColors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  recentMeta: { color: moonColors.textSecondary, fontSize: 12 },
  recentAmountWrap: { alignItems: 'flex-end', marginLeft: moonSpacing[3] },
  recentAmount: { color: moonColors.textPrimary, fontSize: 14, fontWeight: '900', marginBottom: 2 },
  recentChevron: { color: moonColors.textSecondary, fontSize: 20, lineHeight: 20 },
  privacy: { color: moonColors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: moonSpacing[6] },
});
