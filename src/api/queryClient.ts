import { QueryClient } from '@tanstack/react-query';

/**
 * The one React Query cache, in a module of its own so sign-out can empty it.
 *
 * It lived inside App.tsx, where nothing outside the component tree could
 * reach it -- so signing out left every cached answer in place, and several
 * are not keyed by employee (outstanding policies, the notifications inbox,
 * the leave summary). On a store phone shared between shifts, the next person
 * to sign in saw the previous person's data until each query refetched.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // React Query's own focus tracking is built for the web's `window`
      // focus event, which React Native does not have -- so without the
      // AppState bridge in App.tsx this setting does nothing at all, which is
      // why several hooks here grew their own AppState listeners.
      refetchOnWindowFocus: true,
    },
  },
});
