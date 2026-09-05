import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/authStore';
import { registerNotificationHistoryListener } from './src/utils/notifications';
// Registers the background location TaskManager handler at module scope --
// must be imported unconditionally so the OS can find it even after the app
// process was killed while a background task was still scheduled.
import './src/utils/backgroundLocationTask';
// Same reasoning, for the shift-integrity (location-off / Developer Mode)
// background task.
import './src/utils/backgroundIntegrityTask';

const queryClient = new QueryClient();

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

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
        <StatusBar style="auto" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
