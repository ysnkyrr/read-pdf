import { PropsWithChildren, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { moonHaptics } from '../haptics/moonHaptics';
import { moonMotion } from '../theme/tokens';

type MoonPressableProps = PropsWithChildren<
  Omit<PressableProps, 'style' | 'onPressIn' | 'onPressOut'> & {
    style?: StyleProp<ViewStyle>;
    pressedStyle?: StyleProp<ViewStyle>;
    haptic?: boolean;
  }
>;

export function MoonPressable({
  children,
  style,
  pressedStyle,
  haptic = true,
  disabled,
  onPress,
  ...props
}: MoonPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const animate = (toScale: number, toY: number, duration: number) => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: toScale,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: toY,
        duration,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressIn = () => {
    animate(0.99, 1.5, moonMotion.pressIn);
    if (haptic && !disabled) void moonHaptics.light();
  };

  const handlePressOut = () => {
    animate(1, 0, moonMotion.pressOut);
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (!disabled) onPress?.(event);
  };

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={props.accessibilityRole ?? 'button'}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            style,
            pressed && pressedStyle,
            disabled && { opacity: 0.5 },
            { transform: [{ translateY }, { scale }] },
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
