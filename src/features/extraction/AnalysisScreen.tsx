import { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MoonButton } from '../../moonlinea/components/MoonButton';
import { MoonJourney } from '../../moonlinea/components/MoonJourney';
import { MoonText } from '../../moonlinea/components/MoonText';
import { moonColors, moonRadius, moonSpacing } from '../../moonlinea/theme/tokens';
import { analyzeDocument } from '../../services/extractionService';
import { OcrError, OcrProgress } from '../../services/ocr';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Analysis'>;

function stageIndex(progress: OcrProgress | null) {
  if (!progress || progress.stage === 'loading') return 0;
  if (progress.stage === 'reading') return 1;
  return 2;
}

export function AnalysisScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setProgress(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const document = await analyzeDocument(route.params, {
          onProgress: (nextProgress) => {
            if (active) setProgress(nextProgress);
          },
        });
        if (active) navigation.replace('Result', { document });
      } catch (nextError) {
        if (!active) return;
        setError(nextError instanceof Error ? nextError : new Error('OCR failed'));
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [attempt, navigation, route.params]);

  const isNativeUnavailable = error instanceof OcrError && error.code === 'unsupported-native';
  const steps = [t('analysis.step1'), t('analysis.step2'), t('analysis.step3')];
  const currentStage = stageIndex(progress);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        <MoonJourney
          steps={[t('review.journeySelect'), t('review.journeyReview'), t('review.journeyExtract')]}
          currentIndex={2}
        />

        <View style={styles.center}>
          <View style={styles.documentMark} accessibilityElementsHidden>
            <View style={styles.documentLine} />
            <View style={[styles.documentLine, styles.documentLineShort]} />
            <View style={styles.scanBar} />
          </View>

          <MoonText style={styles.title}>
            {error ? (isNativeUnavailable ? t('ocr.nativeTitle') : t('ocr.errorTitle')) : t('analysis.title')}
          </MoonText>
          <MoonText style={styles.subtitle}>
            {error ? (isNativeUnavailable ? t('ocr.nativeBody') : t('ocr.errorBody')) : t('analysis.subtitle')}
          </MoonText>

          {error ? (
            <View style={styles.errorActions}>
              {!isNativeUnavailable ? <MoonButton label={t('ocr.retry')} onPress={retry} /> : null}
              <MoonButton label={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} />
            </View>
          ) : (
            <View style={styles.progressCard}>
              {steps.map((label, index) => {
                const complete = index < currentStage;
                const current = index === currentStage;
                return (
                  <View key={label} style={styles.progressRow}>
                    <View style={[styles.statusDot, complete && styles.statusComplete, current && styles.statusCurrent]}>
                      {complete ? <MoonText style={styles.check}>✓</MoonText> : null}
                    </View>
                    <MoonText style={[styles.progressLabel, (complete || current) && styles.progressLabelActive]}>
                      {label}
                    </MoonText>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {!error ? <MoonText style={styles.localNote}>{t('ocr.localNote')}</MoonText> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: moonColors.background },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: moonSpacing[5],
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: moonSpacing[8] },
  documentMark: {
    width: 78,
    height: 96,
    borderRadius: moonRadius.medium,
    backgroundColor: moonColors.surface,
    borderWidth: 1,
    borderColor: moonColors.border,
    padding: moonSpacing[4],
    marginBottom: moonSpacing[6],
    overflow: 'hidden',
  },
  documentLine: { height: 6, borderRadius: 4, backgroundColor: moonColors.border, marginBottom: moonSpacing[3] },
  documentLineShort: { width: '62%' },
  scanBar: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: moonColors.accent,
  },
  title: { color: moonColors.textPrimary, fontSize: 30, lineHeight: 36, fontWeight: '800', textAlign: 'center', marginBottom: moonSpacing[3] },
  subtitle: { color: moonColors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: moonSpacing[6], maxWidth: 520 },
  progressCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: moonColors.surface,
    borderWidth: 1,
    borderColor: moonColors.border,
    borderRadius: moonRadius.large,
    padding: moonSpacing[5],
    gap: moonSpacing[4],
  },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: moonRadius.pill,
    borderWidth: 2,
    borderColor: moonColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moonSpacing[3],
  },
  statusCurrent: { borderColor: moonColors.accent, backgroundColor: '#EAF0FF' },
  statusComplete: { borderColor: moonColors.success, backgroundColor: moonColors.success },
  check: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  progressLabel: { color: moonColors.textSecondary, fontSize: 15, fontWeight: '600' },
  progressLabelActive: { color: moonColors.textPrimary, fontWeight: '800' },
  errorActions: { width: '100%', maxWidth: 420, gap: moonSpacing[3] },
  localNote: { color: moonColors.textSecondary, fontSize: 11, lineHeight: 17, textAlign: 'center', marginBottom: moonSpacing[3] },
});
