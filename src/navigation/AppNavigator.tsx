import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../features/home/HomeScreen';
import { ReviewScreen } from '../features/documents/ReviewScreen';
import { AnalysisScreen } from '../features/extraction/AnalysisScreen';
import { ResultScreen } from '../features/extraction/ResultScreen';
import { ScannerScreen } from '../features/scanner/ScannerScreen';
import { moonColors } from '../moonlinea/theme/tokens';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: moonColors.background,
    card: moonColors.background,
    text: moonColors.textPrimary,
    border: moonColors.border,
    primary: moonColors.accent,
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: moonColors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Scanner" component={ScannerScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Review" component={ReviewScreen} />
        <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
