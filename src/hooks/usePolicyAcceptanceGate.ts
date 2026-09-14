import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getOutstandingPolicies } from '../api/policies.api';
import { useAuthStore } from '../stores/authStore';

/**
 * Policies that must be acknowledged before the app can be used.
 *
 * The org publishes a policy with `requires_ack`; every employee it addresses
 * owes a signature, per version. Until now that obligation was advertised on a
 * Home card somebody could scroll past forever, which is not what "mandatory"
 * means. This turns it into a gate.
 *
 * ORDER IN THE CHAIN: last, after profile completion and KYC. You cannot
 * meaningfully agree to a policy before the record saying who you are exists,
 * and stacking it earlier would mean signing on behalf of an identity nobody
 * has verified yet.
 *
 * FAILS OPEN, unlike the KYC gate.
 *
 * That is a deliberate difference. KYC blocks because an unverified identity
 * must not punch. A policy acknowledgement is a compliance RECORD, not a
 * security control — and if the API is unreachable, blocking the whole app
 * would stop a field employee clocking in over a network blip, which costs
 * them a shift to protect a signature we can collect thirty seconds later.
 * The obligation is not lost: the server still holds it, and the gate closes
 * again the moment the list can be read.
 */
export function usePolicyAcceptanceGate() {
  const token = useAuthStore((s) => s.token);
  const enabled = Boolean(token);

  const query = useQuery({
    queryKey: ['policies-outstanding'],
    queryFn: getOutstandingPolicies,
    enabled,
    // Same reasoning as the KYC gate: an automatic retry storm only delays
    // showing the app, and the screen has its own way to try again.
    retry: false,
    staleTime: 30_000,
  });

  const refetch = query.refetch;

  /* HR can publish a policy, or acknowledge one on somebody's behalf, while
     this app sits in the background. Without this the employee would not meet
     the gate until the next cold start. */
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refetch();
    });
    return () => sub.remove();
  }, [enabled, refetch]);

  /**
   * Latched to the last SETTLED result, never read live.
   *
   * The screen this gate shows subscribes to the same query, so mounting it
   * triggers a background refetch. A gate derived from the live flags flips
   * false while that refetch is in flight, which unmounts the screen, which
   * cancels the very fetch that would have proven the gate was still needed —
   * an open/closed/open oscillation. useKycGate hit exactly this; latching is
   * the fix that worked there.
   */
  const settled = useRef<{ required: boolean; count: number } | null>(null);
  const [, bump] = useState(0);

  if (query.isSuccess) {
    const count = query.data?.count ?? query.data?.policies?.length ?? 0;
    const required = count > 0;
    if (!settled.current || settled.current.required !== required || settled.current.count !== count) {
      settled.current = { required, count };
      bump((n) => n + 1);
    }
  } else if (query.isError && !settled.current) {
    // Never determined, and unreachable: open. See the note above.
    settled.current = { required: false, count: 0 };
  }

  return {
    isLoading: enabled && settled.current === null,
    gateRequired: Boolean(enabled && settled.current?.required),
    count: settled.current?.count ?? 0,
  };
}
