import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/authStore';
import { useThemeStore } from './src/stores/themeStore';
import { registerNotificationHistoryListener } from './src/utils/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // React Query's own focus tracking is built for the web's `window`
      // focus event, which React Native does not have -- so without the
      // AppState bridge below this setting does nothing at all, which is
      // why several hooks here grew their own AppState listeners.
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * Tell React Query when the app is in the foreground.
 *
 * Returning to the app is the single moment stale data is most visible: the
 * employee has been away, something has probably happened, and they are
 * looking straight at it. Before this, every query waited out the remainder
 * of its polling interval before correcting itself -- up to a full minute of
 * showing a badge that was already wrong.
 *
 * Registered at module scope, not in a component: it concerns the whole app
 * for its whole lifetime, and a subscription mounted and unmounted with a
 * screen would miss exactly the transitions it exists to catch.
 */
AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active');
});

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
