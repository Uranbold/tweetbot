import React, { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ForegroundNotice } from '@/components/ForegroundNotice';
import { NotificationsProvider } from '@/notifications/NotificationsProvider';
import { DeviceProvider } from '@/store/DeviceProvider';
import { darkTheme, lightTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Keep the previous location's data on screen while the next loads (Doherty).
      placeholderData: (prev: unknown) => prev,
    },
  },
});

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  const [fontsLoaded, fontError] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_800ExtraBold });
  const ready = fontsLoaded || !!fontError || Platform.OS === 'web';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <DeviceProvider>
          <NotificationsProvider>
            <StatusBar style={theme.dark ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: theme.colors.bg },
                headerTintColor: theme.colors.fg,
                headerShadowVisible: false,
                headerTitleStyle: { fontFamily: 'Manrope_600SemiBold' },
                contentStyle: { backgroundColor: theme.colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="region/[id]" options={{ title: '' }} />
              <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
            </Stack>
            <ForegroundNotice />
          </NotificationsProvider>
        </DeviceProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
