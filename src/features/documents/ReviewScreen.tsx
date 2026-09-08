import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MoonButton } from '../../moonlinea/components/MoonButton';
import { MoonCard } from '../../moonlinea/components/MoonCard';
import { MoonJourney } from '../../moonlinea/components/MoonJourney';
import { MoonText } from '../../moonlinea/components/MoonText';
import { moonColors, moonRadius, moonSpacing } from '../../moonlinea/theme/tokens';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

function formatBytes(size?: number | null) {
  if (!size) return null;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ReviewScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { uri, name, mimeType, size, source } = route.params;
  const isImage = mimeType?.startsWith('image/') || source === 'camera';
  const formattedSize = formatBytes(size);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MoonButton label={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} style={styles.backButton} />

        <MoonJourney
          steps={[t('review.journeySelect'), t('review.journeyReview'), t('review.journeyExtract')]}
          currentIndex={1}
        />

        <View style={styles.heading}>
          <MoonText style={styles.title}>{t('review.title')}</MoonText>
          <MoonText style={styles.subtitle}>{t('review.subtitle')}</MoonText>
        </View>

        <MoonCard style={styles.previewCard}>
          {isImage ? (
            <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : (
            <View style={styles.pdfPreview}>
              <View style={styles.pdfSheet}>
                <MoonText style={styles.pdfLabel}>PDF</MoonText>
              </View>
            </View>
          )}
        </MoonCard>

        <MoonCard style={styles.fileCard}>
          <MoonText style={styles.metaLabel}>{t('review.fileLabel')}</MoonText>
          <MoonText style={styles.fileName} numberOfLines={2}>{name}</MoonText>
          <View style={styles.metaRow}>
            <MoonText style={styles.metaValue}>{source === 'camera' ? t('review.sourceCamera') : t('review.sourceFile')}</MoonText>
            {mimeType ? <MoonText style={styles.metaValue}>{mimeType}</MoonText> : null}
            {formattedSize ? <MoonText style={styles.metaValue}>{formattedSize}</MoonText> : null}
          </View>
        </MoonCard>

        <MoonButton label={t('review.start')} onPress={() => navigation.navigate('Analysis', route.params)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: moonColors.background },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: moonSpacing[5], paddingBottom: moonSpacing[12] },
  backButton: { alignSelf: 'flex-start', minHeight: 44, marginBottom: moonSpacing[6] },
  heading: { marginTop: moonSpacing[8], marginBottom: moonSpacing[5] },
  title: { color: moonColors.textPrimary, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8, marginBottom: moonSpacing[3] },
  subtitle: { color: moonColors.textSecondary, fontSize: 16, lineHeight: 24 },
  previewCard: { padding: moonSpacing[3], marginBottom: moonSpacing[4], overflow: 'hidden' },
  previewImage: { width: '100%', aspectRatio: 0.76, borderRadius: moonRadius.medium, backgroundColor: moonColors.surfaceMuted },
  pdfPreview: { width: '100%', aspectRatio: 1.3, borderRadius: moonRadius.medium, backgroundColor: moonColors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  pdfSheet: { width: 92, height: 120, borderRadius: 10, backgroundColor: moonColors.surface, borderWidth: 1, borderColor: moonColors.border, alignItems: 'center', justifyContent: 'center' },
  pdfLabel: { color: moonColors.danger, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  fileCard: { marginBottom: moonSpacing[5] },
  metaLabel: { color: moonColors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: moonSpacing[2] },
  fileName: { color: moonColors.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: '800', marginBottom: moonSpacing[4] },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: moonSpacing[2] },
  metaValue: { color: moonColors.textSecondary, fontSize: 12, backgroundColor: moonColors.surfaceMuted, paddingHorizontal: moonSpacing[3], paddingVertical: moonSpacing[2], borderRadius: moonRadius.pill },
});
