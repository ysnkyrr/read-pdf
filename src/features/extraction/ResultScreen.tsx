import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MoonButton } from '../../moonlinea/components/MoonButton';
import { MoonCard } from '../../moonlinea/components/MoonCard';
import { MoonJourney } from '../../moonlinea/components/MoonJourney';
import { MoonText } from '../../moonlinea/components/MoonText';
import { moonHaptics } from '../../moonlinea/haptics/moonHaptics';
import { moonColors, moonRadius, moonSpacing } from '../../moonlinea/theme/tokens';
import { saveDocument } from '../../services/documentStore';
import { ExtractedDocument } from '../../types/document';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

type EditableKey = 'supplierName' | 'supplierTaxNumber' | 'invoiceNumber' | 'invoiceDate' | 'paymentMethod';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  wide?: boolean;
};

function EditableField({ label, value, onChangeText, wide }: FieldProps) {
  return (
    <View style={[styles.field, wide && styles.fieldWide]}>
      <MoonText style={styles.fieldLabel}>{label}</MoonText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        selectionColor={moonColors.accent}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function ResultScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const [document, setDocument] = useState<ExtractedDocument>(route.params.document);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const money = useMemo(
    () => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: document.currency }),
    [document.currency, i18n.language],
  );

  const updateField = (key: EditableKey, value: string) => {
    setDocument((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    await moonHaptics.medium();
    try {
      await saveDocument(document);
      setSaved(true);
      await moonHaptics.success();
      setTimeout(() => navigation.popToTop(), 650);
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = saved ? t('result.saved') : saving ? t('result.saving') : t('result.save');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <MoonJourney
          steps={[t('review.journeySelect'), t('review.journeyReview'), t('review.journeyExtract')]}
          currentIndex={2}
        />

        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <MoonText style={styles.title}>{t('result.title')}</MoonText>
            <MoonText style={styles.subtitle}>{t('result.subtitle')}</MoonText>
          </View>
          <View style={styles.ocrBadge}>
            <MoonText style={styles.ocrBadgeText}>{t('ocr.badge')}</MoonText>
          </View>
        </View>

        <View style={styles.confidenceRow}>
          <MoonText style={styles.confidenceLabel}>{t('result.confidence')}</MoonText>
          <MoonText style={styles.confidenceValue}>{Math.round(document.confidence * 100)}%</MoonText>
        </View>
        <MoonText style={styles.editHint}>{t('result.editHint')}</MoonText>

        <MoonCard style={styles.detailsCard}>
          <View style={styles.fieldsWrap}>
            <EditableField label={t('result.supplier')} value={document.supplierName} onChangeText={(value) => updateField('supplierName', value)} wide />
            <EditableField label={t('result.taxNumber')} value={document.supplierTaxNumber} onChangeText={(value) => updateField('supplierTaxNumber', value)} />
            <EditableField label={t('result.invoiceNumber')} value={document.invoiceNumber} onChangeText={(value) => updateField('invoiceNumber', value)} />
            <EditableField label={t('result.date')} value={document.invoiceDate} onChangeText={(value) => updateField('invoiceDate', value)} />
            <EditableField label={t('result.payment')} value={document.paymentMethod} onChangeText={(value) => updateField('paymentMethod', value)} wide />
          </View>
        </MoonCard>

        <MoonCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <MoonText style={styles.summaryLabel}>{t('result.subtotal')}</MoonText>
            <MoonText style={styles.summaryValue}>{money.format(document.subtotal)}</MoonText>
          </View>
          <View style={styles.summaryRow}>
            <MoonText style={styles.summaryLabel}>{t('result.tax')}</MoonText>
            <MoonText style={styles.summaryValue}>{money.format(document.taxTotal)}</MoonText>
          </View>

          {document.taxBreakdown?.map((row) => (
            <View key={row.rate} style={styles.taxBreakdownRow}>
              <MoonText style={styles.taxBreakdownLabel}>{t('result.tax')} %{row.rate}</MoonText>
              <MoonText style={styles.taxBreakdownValue}>{money.format(row.tax)}</MoonText>
            </View>
          ))}

          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <MoonText style={styles.totalLabel}>{t('result.total')}</MoonText>
            <MoonText style={styles.totalValue}>{money.format(document.total)}</MoonText>
          </View>
        </MoonCard>

        <View style={styles.sectionHeader}>
          <MoonText style={styles.sectionTitle}>{t('result.items')}</MoonText>
          <MoonText style={styles.itemCount}>{document.items.length}</MoonText>
        </View>

        <View style={styles.itemsList}>
          {document.items.map((item, index) => (
            <MoonCard key={`${item.description}-${index}`} style={styles.itemCard}>
              <View style={styles.itemTopRow}>
                <MoonText style={styles.itemTitle}>{item.description}</MoonText>
                <MoonText style={styles.itemTotal}>{money.format(item.total)}</MoonText>
              </View>
              <MoonText style={styles.itemMeta}>
                {t('result.quantity')}: {item.quantity} · {money.format(item.unitPrice)}{item.taxRate != null ? ` · %${item.taxRate}` : ''}
              </MoonText>
            </MoonCard>
          ))}
        </View>

        <MoonButton label={saveLabel} onPress={() => void handleSave()} disabled={saving || saved} style={styles.saveButton} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: moonColors.background },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: moonSpacing[5], paddingBottom: moonSpacing[12] },
  headingRow: { marginTop: moonSpacing[8], marginBottom: moonSpacing[4], flexDirection: 'row', alignItems: 'flex-start', gap: moonSpacing[4] },
  headingCopy: { flex: 1 },
  title: { color: moonColors.textPrimary, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8, marginBottom: moonSpacing[3] },
  subtitle: { color: moonColors.textSecondary, fontSize: 16, lineHeight: 24 },
  ocrBadge: { backgroundColor: '#E7F7EF', borderRadius: moonRadius.pill, paddingHorizontal: moonSpacing[3], paddingVertical: moonSpacing[2] },
  ocrBadgeText: { color: moonColors.success, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moonSpacing[2] },
  confidenceLabel: { color: moonColors.textSecondary, fontSize: 13, fontWeight: '700' },
  confidenceValue: { color: moonColors.success, fontSize: 13, fontWeight: '900' },
  editHint: { color: moonColors.textSecondary, fontSize: 12, marginBottom: moonSpacing[5] },
  detailsCard: { marginBottom: moonSpacing[4] },
  fieldsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: moonSpacing[3] },
  field: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
  fieldWide: { flexBasis: '100%' },
  fieldLabel: { color: moonColors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: moonSpacing[2] },
  input: { minHeight: 48, borderRadius: moonRadius.medium, backgroundColor: moonColors.surfaceMuted, borderWidth: 1, borderColor: moonColors.border, paddingHorizontal: moonSpacing[4], color: moonColors.textPrimary, fontSize: 15, fontWeight: '600' },
  summaryCard: { marginBottom: moonSpacing[6] },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: moonSpacing[2] },
  taxBreakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: moonSpacing[1], paddingLeft: moonSpacing[3] },
  taxBreakdownLabel: { color: moonColors.textSecondary, fontSize: 12 },
  taxBreakdownValue: { color: moonColors.textSecondary, fontSize: 12, fontWeight: '700' },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: moonColors.border, marginTop: moonSpacing[2], paddingTop: moonSpacing[4] },
  summaryLabel: { color: moonColors.textSecondary, fontSize: 14 },
  summaryValue: { color: moonColors.textPrimary, fontSize: 14, fontWeight: '700' },
  totalLabel: { color: moonColors.textPrimary, fontSize: 17, fontWeight: '800' },
  totalValue: { color: moonColors.textPrimary, fontSize: 22, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: moonSpacing[3] },
  sectionTitle: { flex: 1, color: moonColors.textPrimary, fontSize: 18, fontWeight: '800' },
  itemCount: { color: moonColors.textSecondary, fontSize: 12, fontWeight: '800', backgroundColor: moonColors.surfaceMuted, borderRadius: moonRadius.pill, paddingHorizontal: moonSpacing[3], paddingVertical: moonSpacing[1] },
  itemsList: { gap: moonSpacing[3], marginBottom: moonSpacing[6] },
  itemCard: { padding: moonSpacing[4] },
  itemTopRow: { flexDirection: 'row', gap: moonSpacing[3], marginBottom: moonSpacing[2] },
  itemTitle: { flex: 1, color: moonColors.textPrimary, fontSize: 15, fontWeight: '700' },
  itemTotal: { color: moonColors.textPrimary, fontSize: 15, fontWeight: '900' },
  itemMeta: { color: moonColors.textSecondary, fontSize: 12 },
  saveButton: { marginTop: moonSpacing[2] },
});
