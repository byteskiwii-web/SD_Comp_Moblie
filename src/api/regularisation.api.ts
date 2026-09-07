import { apiClient } from './client';

// Top level, not under /attendance. Corrections are their own resource on the
// server even though the app presents them as a tab on the attendance screen.
const BASE = '/regularisation';

export type RegularisationRequestType = 'adjust' | 'other';
export type RegularisationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type Regularisation = {
  id: string;
  employeeId: string;
  storeCode: string;
  markDate: string;
  requestType: RegularisationRequestType;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reason: string;
  status: RegularisationStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
};

export type NewRegularisation = {
  mark_date: string;
  request_type: RegularisationRequestType;
  requested_clock_in?: string;
  requested_clock_out?: string;
  reason: string;
};

/**
 * A reviewer gets their scoped queue here; everyone else gets their own
 * requests. The employee app is always the second case, so this needs no
 * parameters.
 *
 * Paged: `{ items, total, limit, offset }`. Pending first, then oldest first.
 */
export async function getMyRegularisations(limit = 50) {
  const res = await apiClient.get<{
    success: true;
    data: { items: Regularisation[]; total: number; limit: number; offset: number };
  }>(BASE, { params: { limit } });
  return res.data.data;
}

/**
 * Corrections are rationed per calendar month, but the server exposes no
 * balance endpoint — the limit surfaces as REGULARISATION_LIMIT_REACHED on
 * submit. The form says the limit exists rather than counting down to it.
 */
export async function createRegularisation(input: NewRegularisation) {
  const res = await apiClient.post<{ success: true; data: Regularisation }>(BASE, input);
  return res.data.data;
}

/** The employee only, and only while still pending. */
export async function cancelRegularisation(id: string) {
  const res = await apiClient.post<{ success: true; data: Regularisation }>(`${BASE}/${id}/cancel`);
  return res.data.data;
}
