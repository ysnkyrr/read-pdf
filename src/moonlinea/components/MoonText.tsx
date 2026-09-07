import { Text, TextProps } from 'react-native';
import i18n from '../../i18n';

export function MoonText({ style, ...props }: TextProps) {
  const isRTL = i18n.dir() === 'rtl';
  return (
    <Text
      {...props}
      style={[
        { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
        style,
      ]}
    />
  );
}
