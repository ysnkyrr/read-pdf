import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { MoonButton } from '../../moonlinea/components/MoonButton';
import { MoonPressable } from '../../moonlinea/components/MoonPressable';
import { MoonText } from '../../moonlinea/components/MoonText';
import { moonHaptics } from '../../moonlinea/haptics/moonHaptics';
import { moonColors, moonRadius, moonSpacing } from '../../moonlinea/theme/tokens';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export function ScannerScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    if (!cameraRef.current || capturing) return;

    setCapturing(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) throw new Error('capture_failed');
      await moonHaptics.success();
      navigation.replace('Review', {
        uri: photo.uri,
        name: `scan-${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
        size: null,
        source: 'camera',
      });
    } catch {
      setError(t('scanner.captureError'));
      await moonHaptics.warning();
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) {
    return <View style={styles.loading} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionGlyph}>
            <View style={styles.cameraBody}><View style={styles.cameraLens} /></View>
          </View>
          <MoonText style={styles.permissionTitle}>{t('scanner.permissionTitle')}</MoonText>
          <MoonText style={styles.permissionBody}>{t('scanner.permissionBody')}</MoonText>
          <MoonButton label={t('scanner.permissionAction')} onPress={requestPermission} />
          <MoonButton label={t('common.back')} variant="secondary" onPress={() => navigation.goBack()} style={styles.backButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {isFocused ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" /> : null}
      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <MoonPressable onPress={() => navigation.goBack()} style={styles.backCircle} accessibilityLabel={t('common.back')}>
            <MoonText style={styles.backGlyph}>‹</MoonText>
          </MoonPressable>
          <View style={styles.headerCopy}>
            <MoonText style={styles.title}>{t('scanner.title')}</MoonText>
            <MoonText style={styles.subtitle}>{t('scanner.subtitle')}</MoonText>
          </View>
        </View>

        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        <View style={styles.controls}>
          {error ? <MoonText style={styles.error}>{error}</MoonText> : null}
          <MoonPressable
            onPress={capture}
            disabled={capturing}
            accessibilityLabel={t('scanner.capture')}
            style={styles.shutterOuter}
            haptic={false}
          >
            <View style={styles.shutterInner} />
          </MoonPressable>
          <MoonText style={styles.captureLabel}>{t('scanner.capture')}</MoonText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, backgroundColor: moonColors.background },
  permissionScreen: { flex: 1, backgroundColor: moonColors.background, justifyContent: 'center', padding: moonSpacing[5] },
  permissionCard: { width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: moonColors.surface, borderRadius: moonRadius.large, borderWidth: 1, borderColor: moonColors.border, padding: moonSpacing[6] },
  permissionGlyph: { width: 52, height: 52, borderRadius: moonRadius.medium, backgroundColor: moonColors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: moonSpacing[5] },
  cameraBody: { width: 26, height: 18, borderWidth: 2, borderColor: moonColors.textPrimary, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  cameraLens: { width: 7, height: 7, borderRadius: 4, borderWidth: 2, borderColor: moonColors.textPrimary },
  permissionTitle: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: moonColors.textPrimary, marginBottom: moonSpacing[3] },
  permissionBody: { fontSize: 15, lineHeight: 23, color: moonColors.textSecondary, marginBottom: moonSpacing[6] },
  backButton: { marginTop: moonSpacing[3] },
  scrimTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 190, backgroundColor: 'rgba(0,0,0,0.42)' },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 190, backgroundColor: 'rgba(0,0,0,0.50)' },
  overlay: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: moonSpacing[4], paddingTop: moonSpacing[3] },
  backCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', marginRight: moonSpacing[3] },
  backGlyph: { color: '#fff', fontSize: 34, lineHeight: 36, marginTop: -3 },
  headerCopy: { flex: 1, paddingTop: 2 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 19 },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: moonSpacing[5], paddingVertical: moonSpacing[5] },
  frame: { width: '100%', maxWidth: 520, aspectRatio: 0.72, borderRadius: moonRadius.large, position: 'relative' },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: '#fff' },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 },
  controls: { minHeight: 160, alignItems: 'center', justifyContent: 'center', paddingBottom: moonSpacing[3] },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  captureLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: moonSpacing[2], textAlign: 'center' },
  error: { color: '#fff', backgroundColor: 'rgba(180,35,24,0.78)', borderRadius: 10, paddingHorizontal: moonSpacing[3], paddingVertical: moonSpacing[2], marginBottom: moonSpacing[3], fontSize: 12 },
});
