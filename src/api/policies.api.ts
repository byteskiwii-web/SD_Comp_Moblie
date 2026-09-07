import { apiClient } from './client';

export type PolicyStatus = 'draft' | 'published' | 'archived';

export type Policy = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  version: number;
  status: PolicyStatus;
  requiresAck: boolean;
  effectiveFrom: string | null;
  publishedAt: string | null;
  hasFile: boolean;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
  /** Counts the CURRENT version only — a republish resets who has signed. */
  acknowledgedCount: number;
  acknowledgedByMe: boolean;
};

/**
 * The caller's own unacknowledged published policies. The contract names this
 * as what the mobile home screen asks for, so it is one call rather than
 * fetching the library and filtering on the device.
 */
export async function getOutstandingPolicies() {
  const res = await apiClient.get<{ success: true; data: { count: number; policies: Policy[] } }>(
    '/policies/outstanding'
  );
  return res.data.data;
}

/**
 * The library. A field employee sees only `published` ones; the server decides
 * that from the session, so there is nothing to pass here.
 *
 * `data` is the array and paging rides in `meta` — the same envelope as kudos.
 */
export async function getPolicies(limit = 50) {
  const res = await apiClient.get<{
    success: true;
    data: Policy[];
    meta: { total: number; limit: number; offset: number };
  }>('/policies', { params: { limit } });
  return { items: res.data.data, total: res.data.meta?.total ?? res.data.data.length };
}

/** Signing is per version: a republished policy has to be acknowledged again. */
export async function acknowledgePolicy(id: string) {
  const res = await apiClient.post<{ success: true; data: Policy }>(`/policies/${id}/acknowledge`);
  return res.data.data;
}
