import { useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MoonButton } from '../../moonlinea/components/MoonButton';
import { MoonCard } from '../../moonlinea/components/MoonCard';
import { MoonJourney } from '../../moonlinea/components/MoonJourney';
import { MoonPressable } from '../../moonlinea/components/MoonPressable';
import { MoonText } from '../../moonlinea/components/MoonText';
import { moonHaptics } from '../../moonlinea/haptics/moonHaptics';
import { moonColors, moonRadius, moonSpacing } from '../../moonlinea/theme/tokens';
import { learnFromCorrection } from '../../services/correctionMemory';
import { deleteDocument, saveDocument } from '../../services/documentStore';
import { ExtractedDocument, ExtractedLineItem } from '../../types/document';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

type EditableKey = 'supplierName' | 'supplierTaxNumber' | 'invoiceNumber' | 'invoiceDate' | 'paymentMethod';
type NumericDocumentKey = 'subtotal' | 'taxTotal' | 'total';
type DialogType = 'discard' | 'delete' | null;

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  wide?: boolean;
  standalone?: boolean;
};

type NumericFieldProps = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  compact?: boolean;
};

function EditableField({ label, value, onChangeText, wide, standalone }: FieldProps) {
  return (
    <View style={[styles.field, wide && styles.fieldWide, standalone && styles.fieldStandalone]}>
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

function parseEditableNumber(raw: string) {
  let value = raw.trim().replace(/[^0-9,.-]/g, '');
  if (!value) return 0;
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    value = comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, '');
  } else if (comma >= 0) {
    value = value.replace(/\./g, '').replace(',', '.');
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function NumericField({ label, value, onCommit, compact }: NumericFieldProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const next = parseEditableNumber(text);
    setText(String(next));
    onCommit(next);
  };

  return (
    <View style={[styles.numericField, compact && styles.numericFieldCompact]}>
      <MoonText style={styles.fieldLabel}>{label}</MoonText>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        style={styles.input}
        selectionColor={moonColors.accent}
        accessibilityLabel={label}
      />
    </View>
  );
}

function sameDocument(a: ExtractedDocument, b: ExtractedDocument) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ResultScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const originalDocument = useRef<ExtractedDocument>(route.params.document);
  const [document, setDocument] = useState<ExtractedDocument>(route.params.document);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dialog, setDialog] = useState<DialogType>(null);
  const isArchive = route.params.origin === 'archive';
  const dirty = !sameDocument(document, originalDocument.current);

  const money = useMemo(
    () => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: document.currency }),
    [document.currency, i18n.language],
  );

  const updateField = (key: EditableKey, value: string) => {
    setSaved(false);
    setDocument((current) => ({ ...current, [key]: value }));
  };

  const updateNumberField = (key: NumericDocumentKey, value: number) => {
    setSaved(false);
    setDocument((current) => {
      const next = { ...current, [key]: value };
      if (key === 'subtotal' && current.taxBreakdown?.length === 1) {
        next.taxBreakdown = [{ ...current.taxBreakdown[0], base: value }];
      }
      if (key === 'taxTotal' && current.taxBreakdown?.length === 1) {
        next.taxBreakdown = [{ ...current.taxBreakdown[0], tax: value }];
      }
      return next;
    });
  };

  const updateItemText = (index: number, value: string) => {
    setSaved(false);
    setDocument((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, description: value } : item),
    }));
  };

  const updateItemNumber = (index: number, key: 'quantity' | 'unitPrice' | 'taxRate' | 'total', value: number) => {
    setSaved(false);
    setDocument((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next: ExtractedLineItem = { ...item, [key]: value };
        if (key === 'quantity' || key === 'unitPrice') {
          next.total = Math.round(next.quantity * next.unitPrice * 100) / 100;
        }
        return next;
      }),
    }));
  };

  const addItem = () => {
    setSaved(false);
    setDocument((current) => ({
      ...current,
      items: [...current.items, { description: '', quantity: 1, unitPrice: 0, taxRate: null, total: 0 }],
    }));
  };

  const removeItem = (index: number) => {
    setSaved(false);
    setDocument((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const leaveResult = () => {
    setDialog(null);
    navigation.popToTop();
  };

  const requestExit = () => {
    if (isArchive && !dirty) {
      navigation.popToTop();
      return;
    }
    setDialog('discard');
  };

  const handleSave = async () => {
    if (saving || deleting) return;
    setSaving(true);
    await moonHaptics.medium();
    try {
      await learnFromCorrection(originalDocument.current, document);
      await saveDocument(document);
      originalDocument.current = document;
      setSaved(true);
      await moonHaptics.success();
      setTimeout(() => navigation.popToTop(), 550);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isArchive || deleting || saving) return;
    setDeleting(true);
    await moonHaptics.medium();
    try {
      await deleteDocument(document.id);
      setDialog(null);
      await moonHaptics.success();
      navigation.popToTop();
    } finally {
      setDeleting(false);
    }
  };

  const saveLabel = saved
    ? t('result.saved')
    : saving
      ? t('result.saving')
      : isArchive
        ? t('management.saveChanges')
        : t('result.save');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <MoonPressable onPress={requestExit} accessibilityLabel={t('management.back')} style={styles.backAction}>
            <MoonText style={styles.backGlyph}>‹</MoonText>
            <MoonText style={styles.backLabel}>{t('management.back')}</MoonText>
          </MoonPressable>
        </View>

        <MoonJourney
          steps={[t('review.journeySelect'), t('review.journeyReview'), t('review.journeyExtract')]}
          currentIndex={2}
        />

        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <MoonText style={styles.title}>{isArchive ? t('management.editTitle') : t('result.title')}</MoonText>
            <MoonText style={styles.subtitle}>{isArchive ? t('management.editSubtitle') : t('result.subtitle')}</MoonText>
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
          <View style={styles.summaryEditGrid}>
            <NumericField label={t('management.subtotalEdit')} value={document.subtotal} onCommit={(value) => updateNumberField('subtotal', value)} />
            <NumericField label={t('management.taxEdit')} value={document.taxTotal} onCommit={(value) => updateNumberField('taxTotal', value)} />
            <NumericField label={t('management.totalEdit')} value={document.total} onCommit={(value) => updateNumberField('total', value)} />
          </View>

          {document.taxBreakdown?.map((row) => (
            <View key={row.rate} style={styles.taxBreakdownRow}>
              <MoonText style={styles.taxBreakdownLabel}>{t('result.tax')} %{row.rate}</MoonText>
              <MoonText style={styles.taxBreakdownValue}>{money.format(row.tax)}</MoonText>
            </View>
          ))}
        </MoonCard>

        <View style={styles.sectionHeader}>
          <MoonText style={styles.sectionTitle}>{t('result.items')}</MoonText>
          <MoonText style={styles.itemCount}>{document.items.length}</MoonText>
        </View>

        <View style={styles.itemsList}>
          {document.items.map((item, index) => (
            <MoonCard key={`item-${index}`} style={styles.itemCard}>
              <EditableField
                label={t('management.itemDescription')}
                value={item.description}
                onChangeText={(value) => updateItemText(index, value)}
                wide
                standalone
              />
              <View style={styles.itemEditGrid}>
                <NumericField label={t('result.quantity')} value={item.quantity} onCommit={(value) => updateItemNumber(index, 'quantity', value)} compact />
                <NumericField label={t('management.unitPrice')} value={item.unitPrice} onCommit={(value) => updateItemNumber(index, 'unitPrice', value)} compact />
                <NumericField label={t('management.taxRate')} value={item.taxRate ?? 0} onCommit={(value) => updateItemNumber(index, 'taxRate', value)} compact />
                <NumericField label={t('management.lineTotal')} value={item.total} onCommit={(value) => updateItemNumber(index, 'total', value)} compact />
              </View>
              <MoonButton label={t('management.removeItem')} variant="secondary" onPress={() => removeItem(index)} style={styles.removeItemButton} />
            </MoonCard>
          ))}
        </View>

        <MoonButton label={t('management.addItem')} variant="secondary" onPress={addItem} style={styles.addItemButton} />
        <MoonButton label={saveLabel} onPress={() => void handleSave()} disabled={saving || deleting || saved} style={styles.saveButton} />
        <MoonButton label={t('management.exitWithoutSaving')} variant="secondary" onPress={requestExit} style={styles.secondaryAction} />
        {isArchive ? (
          <MoonButton label={t('management.deleteDocument')} variant="danger" onPress={() => setDialog('delete')} style={styles.deleteButton} />
        ) : null}
      </ScrollView>

      <Modal transparent visible={dialog !== null} animationType="fade" onRequestClose={() => setDialog(null)}>
        <View style={styles.modalBackdrop}>
          <MoonCard style={styles.dialogCard}>
            <MoonText style={styles.dialogTitle}>
              {dialog === 'delete' ? t('management.deleteTitle') : t('management.discardTitle')}
            </MoonText>
            <MoonText style={styles.dialogBody}>
              {dialog === 'delete' ? t('management.deleteBody') : t('management.discardBody')}
            </MoonText>
            <View style={styles.dialogActions}>
              <MoonButton
                label={dialog === 'delete' ? t('management.deleteConfirm') : t('management.discardConfirm')}
                variant="danger"
                onPress={dialog === 'delete' ? () => void handleDelete() : leaveResult}
                disabled={deleting}
              />
              <MoonButton label={t('management.keepEditing')} variant="secondary" onPress={() => setDialog(null)} />
            </View>
          </MoonCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: moonColors.background },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: moonSpacing[5], paddingBottom: moonSpacing[12] },
  topBar: { minHeight: 44, justifyContent: 'center', marginBottom: moonSpacing[3] },
  backAction: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingRight: moonSpacing[3] },
  backGlyph: { color: moonColors.textPrimary, fontSize: 30, lineHeight: 30, marginRight: 3, marginTop: -2 },
  backLabel: { color: moonColors.textPrimary, fontSize: 14, fontWeight: '700' },
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
  fieldStandalone: { flexGrow: 0, flexBasis: 'auto', width: '100%' },
  numericField: { flexGrow: 1, flexBasis: 200, minWidth: 0 },
  numericFieldCompact: { flexBasis: 140 },
  fieldLabel: { color: moonColors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: moonSpacing[2] },
  input: { minHeight: 48, borderRadius: moonRadius.medium, backgroundColor: moonColors.surfaceMuted, borderWidth: 1, borderColor: moonColors.border, paddingHorizontal: moonSpacing[4], color: moonColors.textPrimary, fontSize: 15, fontWeight: '600' },
  summaryCard: { marginBottom: moonSpacing[6] },
  summaryEditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: moonSpacing[3] },
  taxBreakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: moonSpacing[3], marginTop: moonSpacing[3], borderTopWidth: 1, borderTopColor: moonColors.border },
  taxBreakdownLabel: { color: moonColors.textSecondary, fontSize: 12 },
  taxBreakdownValue: { color: moonColors.textSecondary, fontSize: 12, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: moonSpacing[3] },
  sectionTitle: { flex: 1, color: moonColors.textPrimary, fontSize: 18, fontWeight: '800' },
  itemCount: { color: moonColors.textSecondary, fontSize: 12, fontWeight: '800', backgroundColor: moonColors.surfaceMuted, borderRadius: moonRadius.pill, paddingHorizontal: moonSpacing[3], paddingVertical: moonSpacing[1] },
  itemsList: { gap: moonSpacing[3], marginBottom: moonSpacing[3] },
  itemCard: { padding: moonSpacing[4] },
  itemEditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: moonSpacing[3], marginTop: moonSpacing[3] },
  removeItemButton: { marginTop: moonSpacing[3], minHeight: 44 },
  addItemButton: { marginBottom: moonSpacing[5] },
  saveButton: { marginTop: moonSpacing[2] },
  secondaryAction: { marginTop: moonSpacing[3] },
  deleteButton: { marginTop: moonSpacing[6] },
  modalBackdrop: { flex: 1, backgroundColor: moonColors.overlay, alignItems: 'center', justifyContent: 'center', padding: moonSpacing[5] },
  dialogCard: { width: '100%', maxWidth: 480, padding: moonSpacing[6] },
  dialogTitle: { color: moonColors.textPrimary, fontSize: 22, lineHeight: 28, fontWeight: '800', marginBottom: moonSpacing[3] },
  dialogBody: { color: moonColors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: moonSpacing[5] },
  dialogActions: { gap: moonSpacing[3] },
});
