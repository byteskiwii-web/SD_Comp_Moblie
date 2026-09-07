import { apiClient } from './client';

// Mounted under attendance on the server: a correction is part of attendance to
// everyone using it, and the app shows it as a tab on the attendance screen.
const BASE = '/attendance/regularisation';

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
  createdBy: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
};

/**
 * Three corrections per employee per calendar month, counted on the day being
 * corrected. Read before rendering the form so the remaining balance is visible
 * in advance rather than discovered on submit.
 */
export type RegularisationBalance = {
  month: string;
  limit: number;
  used: number;
  remaining: number;
};

export type NewRegularisation = {
  mark_date: string;
  request_type: RegularisationRequestType;
  requested_clock_in?: string;
  requested_clock_out?: string;
  reason: string;
};

export async function getMyRegularisations() {
  const res = await apiClient.get<{ success: true; data: { items: Regularisation[] } }>(BASE);
  return res.data.data.items;
}

export async function getRegularisationBalance(markDate?: string) {
  const res = await apiClient.get<{ success: true; data: RegularisationBalance }>(`${BASE}/balance`, {
    params: markDate ? { mark_date: markDate } : undefined,
  });
  return res.data.data;
}

export async function createRegularisation(input: NewRegularisation) {
  const res = await apiClient.post<{ success: true; data: Regularisation }>(BASE, input);
  return res.data.data;
}

export async function cancelRegularisation(id: string) {
  const res = await apiClient.post<{ success: true; data: Regularisation }>(`${BASE}/${id}/cancel`);
  return res.data.data;
}
