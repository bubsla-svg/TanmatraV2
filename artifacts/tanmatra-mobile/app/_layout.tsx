import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Stack} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';
import React, {useEffect} from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {setAuthTokenGetter, setBaseUrl} from '@workspace/api-client-react';

import {ErrorBoundary} from '@/components/ErrorBoundary';
import {getTokenSync, loadToken} from '@/lib/auth';

// Harden startup: don't fail app boot if splash API errors
void SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op
});

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) {
  setBaseUrl(`https://${domain}`);
}

setAuthTokenGetter(async () => {
  const cached = getTokenSync();
  if (cached) return cached;
  return await loadToken();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: '#050505'},
      }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {
        // no-op
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{flex: 1, backgroundColor: '#050505'}}>
            <KeyboardProvider>
              <StatusBar style="light" />
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
