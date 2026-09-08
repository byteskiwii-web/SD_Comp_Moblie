import { create } from 'zustand';

/**
 * Whether the tour is running.
 *
 * It is global state rather than a `useState` in whichever screen owns the
 * button, and that is forced by what the tour now does: it walks you to each
 * tab. A tour mounted inside Profile unmounts the moment it navigates to
 * Attendance, taking itself off the screen mid-sentence. So exactly one
 * instance lives above the tab navigator, and the buttons on Home and Profile
 * only ask it to start.
 */
type TourState = {
  open: boolean;
  start: () => void;
  stop: () => void;
};

export const useTourStore = create<TourState>((set) => ({
  open: false,
  start: () => set({ open: true }),
  stop: () => set({ open: false }),
}));
