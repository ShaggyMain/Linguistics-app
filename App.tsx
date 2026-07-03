import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/app/HomeScreen';
import type { RootStackParamList } from './src/app/navigation';
import { ReaderScreen } from './src/app/ReaderScreen';
import { SettingsScreen } from './src/app/SettingsScreen';
import { colors } from './src/theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Reader" component={ReaderScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
