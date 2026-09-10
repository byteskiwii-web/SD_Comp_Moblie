import { create } from 'zustand';

/**
 * Whether the app can actually reach the server right now.
 *
 * NOT from a network library. @react-native-community/netinfo is a native
 * module, and a native module that is missing from Expo Go throws at
 * module-evaluation time and takes the whole bundle down before first paint --
 * which is exactly how this app lost a day to expo-notifications. The risk is
 * not worth it for a status line.
 *
 * More to the point, netinfo answers the wrong question. It reports whether
 * the RADIO is up, and a phone on café Wi-Fi with a captive portal, or inside
 * a store with signal but no route to our API, is "connected" and cannot punch.
 * What the employee needs to know is whether their mark will reach the server,
 * and the only honest evidence for that is whether the last call to the server
 * did.
 *
 * So this is fed by the API client itself: a response of any status means the
 * server was reached; a request that came back with no response at all means it
 * was not. It starts as `unknown` rather than `online`, because claiming a
 * working connection before anything has been tried would be a guess printed
 * on the one screen that must not guess.
 */
export type Reachability = 'unknown' | 'online' | 'offline';

type ConnectivityState = {
  status: Reachability;
  /** When the server was last reached. Null until it has been. */
  lastReachedAt: number | null;
  markReached: () => void;
  markUnreachable: () => void;
};

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  status: 'unknown',
  lastReachedAt: null,
  markReached: () => set({ status: 'online', lastReachedAt: Date.now() }),
  // The timestamp is deliberately kept: "offline since 10:14" is a more useful
  // thing to know than a bare offline flag, and losing it on every blip would
  // make the moment of disconnection unrecoverable.
  markUnreachable: () => set({ status: 'offline' }),
}));

/** Readable outside React, for the interceptor that feeds it. */
export const currentReachability = (): Reachability => {
  try {
    return useConnectivityStore.getState().status;
  } catch {
    return 'unknown';
  }
};
