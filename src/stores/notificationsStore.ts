import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Alerts THIS DEVICE raised, and only those.
//
// Background tasks fire these (clock-out reminder, geofence, shift-integrity)
// from a headless context, often with the app killed and sometimes with no
// connectivity -- so they cannot come from, or be written back to, the server.
// The organisation's own inbox is a separate feed with a separate lifecycle;
// see src/api/notifications.api.ts. useNotificationInbox merges the two for
// display, deliberately without persisting server rows here, where they would
// go stale and could never be reconciled with the web console's view.
//
// There is still no push infrastructure -- these are local notifications only
// (see src/utils/notifications.ts). Persisted the same way shiftStore.ts
// persists shift state, so this introduces no new pattern and no new native
// dependency.
export type LocalNotificationType =
  | 'clock-out-reminder'
  | 'geofence-alert'
  | 'integrity-warning'
  | 'integrity-escalated'
  | 'general';

export type LocalNotification = {
  id: string;
  type: LocalNotificationType;
  title: string;
  body: string;
  timestamp: string; // ISO
  read: boolean;
};

const MAX_ITEMS = 50;

type NotificationsState = {
  items: LocalNotification[];
  add: (n: { type: LocalNotificationType; title: string; body: string }) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],
      add: (n) =>
        set((state) => ({
          items: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              timestamp: new Date().toISOString(),
              read: false,
              ...n,
            },
            ...state.items,
          ].slice(0, MAX_ITEMS),
        })),
      markAllRead: () => set((state) => ({ items: state.items.map((i) => ({ ...i, read: true })) })),
      remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'zip_hrms_notifications',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// There is deliberately no unread-count selector here. The badge counts BOTH
// feeds, so a local-only count is a number no caller actually wants -- one
// exported from this file would read as authoritative and quietly under-report
// every server notification. useNotificationInbox owns that total.
//
// Storing a count on the state would be wrong for a second reason: it is a
// second source of truth that could drift from `items` after a stale write.
