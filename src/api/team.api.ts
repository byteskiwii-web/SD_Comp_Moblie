import { apiClient } from './client';
import type { Regularisation } from './regularisation.api';

/**
 * The team lead's read-only view.
 *
 * Every call here is an EXISTING scoped endpoint, unchanged. Nothing filters
 * client-side and nothing passes a store code: the server pins a site-scoped
 * principal to their own store whatever the request asks for, so the phone
 * cannot widen the view by editing a parameter, and a lead who is transferred
 * sees the new store without the app being told.
 *
 * There is no write here, and that is not an omission. The role is refused at
 * every write path by name (see AUTH_READ_ONLY_ROLES) — offering a button that
 * the server will always answer 403 to would be inventing authority the
 * account does not have.
 */

/** One row per employee per day. Absences are real rows, not gaps. */
export type RegisterRow = {
  employeeId: string;
  name: string;
  storeCode: string;
  storeName: string | null;
  date: string;
  present: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  workedMinutes: number | null;
  late: boolean;
  outOfFence: boolean;
  awaitingApproval: boolean;
  maxDistanceMetres: number | null;
  markCount: number;
  geofenceExempt: boolean;
};

export type LivePerson = {
  employeeId: string;
  name: string;
  onShift: boolean;
  lastMarkType: 'clock-in' | 'clock-out' | null;
  lastMarkAt: string | null;
};

/**
 * Who is on shift right now.
 *
 * The one question a lead opens the app to ask, so it is the first thing the
 * panel shows.
 */
export async function getTeamLive(): Promise<LivePerson[]> {
  const res = await apiClient.get<{ success: true; data: LivePerson[] }>('/attendance/live');
  return res.data.data ?? [];
}

/**
 * The register over a window.
 *
 * `from === to` is one day; a month's bounds are the log. One question asked
 * twice, so one route — the server bounds it to 62 days.
 */
export async function getTeamRegister(from: string, to: string, limit = 500): Promise<RegisterRow[]> {
  const res = await apiClient.get<{ success: true; data: RegisterRow[] }>('/attendance/register', {
    params: { from, to, limit },
  });
  return res.data.data ?? [];
}

/**
 * The team's correction requests.
 *
 * Same endpoint the employee app calls for its own list. The server decides
 * whose rows come back — a read-only site role gets the store, an employee
 * gets themselves — so there is one code path and no client-side branch that
 * could disagree with it.
 */
export async function getTeamRegularisations(limit = 100): Promise<Regularisation[]> {
  const res = await apiClient.get<{ success: true; data: Regularisation[] }>('/regularisation', {
    params: { limit },
  });
  const body = res.data.data as unknown;
  // Tolerated because the sibling regularisation client types this as a paged
  // object while the controller returns a bare array. Reading both shapes here
  // costs one line and removes a crash from a contract nobody has reconciled.
  if (Array.isArray(body)) return body as Regularisation[];
  return ((body as { items?: Regularisation[] })?.items ?? []) as Regularisation[];
}
