import { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MoonJourney } from '../../moonlinea/components/MoonJourney';
import { MoonText } from '../../moonlinea/components/MoonText';
import { moonColors, moonRadius, moonSpacing } from '../../moonlinea/theme/tokens';
import { analyzeDocument } from '../../services/extractionService';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Analysis'>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AnalysisScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setStage(0);
      await wait(450);
      if (!active) return;
      setStage(1);

      await wait(520);
      if (!active) return;
      setStage(2);

      const document = await analyzeDocument(route.params);
      if (!active) return;

      await wait(350);
      if (active) navigation.replace('Result', { document });
    };

    void run();
    return () => {
      active = false;
    };
  }, [navigation, route.params]);

  const steps = [t('analysis.step1'), t('analysis.step2'), t('analysis.step3')];

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

          <MoonText style={styles.title}>{t('analysis.title')}</MoonText>
          <MoonText style={styles.subtitle}>{t('analysis.subtitle')}</MoonText>

          <View style={styles.progressCard}>
            {steps.map((label, index) => {
              const complete = index < stage;
              const current = index === stage;
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
        </View>

        <MoonText style={styles.demoNote}>{t('analysis.demo')}</MoonText>
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
  subtitle: { color: moonColors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: moonSpacing[6] },
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
  demoNote: { color: moonColors.textSecondary, fontSize: 11, lineHeight: 17, textAlign: 'center', marginBottom: moonSpacing[3] },
});
