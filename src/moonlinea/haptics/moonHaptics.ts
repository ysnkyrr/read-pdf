import * as Haptics from 'expo-haptics';

const safeHaptic = async (action: () => Promise<void>) => {
  try {
    await action();
  } catch {
    // Haptics are optional feedback. The interaction must remain understandable without them.
  }
};

export const moonHaptics = {
  light: () => safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
