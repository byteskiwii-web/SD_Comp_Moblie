import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * A handle on the navigator for code that runs outside any screen — a tap on
 * a push notification arrives in a listener, not a component, and it needs
 * to move the app somewhere. Attached to NavigationContainer in
 * RootNavigator; `isReady()` is false until then and callers must check it.
 */
export const navigationRef = createNavigationContainerRef<any>();
