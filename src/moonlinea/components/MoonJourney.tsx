import { StyleSheet, View } from 'react-native';
import { MoonText } from './MoonText';
import { moonColors, moonRadius, moonSpacing } from '../theme/tokens';

type Props = {
  steps: string[];
  currentIndex: number;
};

export function MoonJourney({ steps, currentIndex }: Props) {
  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {steps.map((step, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;
        return (
          <View key={`${step}-${index}`} style={styles.stepWrap}>
            <View
              style={[
                styles.dot,
                (complete || current) && styles.dotActive,
                current && styles.dotCurrent,
              ]}
            />
            <MoonText style={[styles.label, current && styles.labelCurrent]} numberOfLines={1}>
              {step}
            </MoonText>
            {index < steps.length - 1 ? (
              <View style={[styles.line, complete && styles.lineActive]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: moonSpacing[2],
  },
  stepWrap: {
    flex: 1,
    position: 'relative',
    alignItems: 'flex-start',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: moonRadius.pill,
    backgroundColor: moonColors.border,
    marginBottom: moonSpacing[2],
  },
  dotActive: {
    backgroundColor: moonColors.textPrimary,
  },
  dotCurrent: {
    width: 12,
    height: 12,
  },
  line: {
    position: 'absolute',
    top: 5,
    left: 14,
    right: -4,
    height: 1,
    backgroundColor: moonColors.border,
  },
  lineActive: {
    backgroundColor: moonColors.textPrimary,
  },
  label: {
    color: moonColors.textSecondary,
    fontSize: 12,
  },
  labelCurrent: {
    color: moonColors.textPrimary,
    fontWeight: '700',
  },
});
