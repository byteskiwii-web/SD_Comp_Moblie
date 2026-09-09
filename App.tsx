import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/authStore';
import { useThemeStore } from './src/stores/themeStore';
import { registerNotificationHistoryListener } from './src/utils/notifications';

const queryClient = new QueryClient();

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  // The in-app toggle (themeStore) is a standing user choice, independent of
  // the OS appearance setting once made -- see themeStore.ts. StatusBar's own
  // "auto" tracks the OS instead, which would leave the status bar icons on
  // the wrong colour the moment someone picks a mode here that disagrees
  // with their phone's system setting.
  const themeMode = useThemeStore((s) => s.mode);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Captures every locally-fired notification (clock-out reminder, geofence
  // alert) into the on-device history the bell panel reads. One subscription
  // for the app's whole lifetime.
  useEffect(() => {
    const sub = registerNotificationHistoryListener();
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
