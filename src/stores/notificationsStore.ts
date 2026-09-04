import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local, on-device notification history -- there is no backend notification
// table or push infrastructure (deliberately: see src/utils/notifications.ts).
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
  markAllRead: () => void;
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
