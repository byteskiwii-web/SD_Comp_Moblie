import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// On-device notification history: alerts THIS PHONE raised, which the backend
// never hears about -- a clock-out reminder, a geofence warning, an integrity
// escalation. Captured from the OS by registerNotificationHistoryListener.
//
// Not a substitute for the server inbox, which has existed since migration 023
// and holds everything the org did to the employee's record. The two are
// merged for display in screens/notifications/feed.ts; this store owns only
// the device half, including its read state, because there is no row on the
// server to carry it.
//
// Persisted the same way shiftStore.ts already persists shift state, so this
// introduces no new pattern and no new native dependency.
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
  /** One item, by id. Mirrors the server inbox's per-row mark-read. */
  setRead: (id: string, read: boolean) => void;
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
      setRead: (id, read) =>
        set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, read } : i)) })),
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

// Derived, not stored -- an unreadCount field on the state would be a second
// source of truth that could drift from `items` after a stale write.
export function selectUnreadCount(state: NotificationsState): number {
  return state.items.filter((i) => !i.read).length;
}
