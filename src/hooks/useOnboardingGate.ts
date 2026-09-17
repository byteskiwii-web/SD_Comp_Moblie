import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { getMyOnboarding, type OnboardingStatus } from '../api/auth.api';

/**
 * The one gate between sign-in and the tabs.
 *
 * It replaces two: the profile-completion gate and the KYC gate, which
 * between them checked some of the steps, for some roles, only while the
 * verification provider happened to be switched on. The server now owns the
 * definition (GET /auth/me/onboarding): profile, PAN, Aadhaar, PAN–Aadhaar
 * link, bank, HR approval -- and the same rule refuses a clock-in, so
 * nothing here is a security boundary, only the screen that explains it.
 *
 * Shares its cache key with the old KYC gate on purpose: every verification
 * screen already invalidates that key on success, and the checklist updates
 * the moment a check passes without those screens changing.
 *
 * Latched to the last SETTLED answer, for the reason useKycGate documents:
 * the checklist mounting triggers a refetch of this very query, and reading
 * the live flags would flip the gate open mid-flight and unmount it.
 */
export const onboardingGateQueryKey = (employeeId?: string) => ['kyc-gate', employeeId] as const;

export function useOnboardingGate() {
  const employee = useAuthStore((s) => s.employee);
  const query = useQuery({
    queryKey: onboardingGateQueryKey(employee?.id),
    queryFn: getMyOnboarding,
    enabled: !!employee,
    retry: false,
  });

  useEffect(() => {
    if (!employee) return;
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') query.refetch(); });
    return () => sub.remove();
  }, [employee, query.refetch]);

  const settled = useRef<{ required: boolean; status: OnboardingStatus | null; failed: boolean } | null>(null);
  const [, force] = useState(0);
  if (query.isError) {
    if (!settled.current || !settled.current.failed) {
      // Unknown is closed: a client that cannot learn whether it may proceed
      // must not proceed. The screen offers Retry and Sign out.
      settled.current = { required: true, status: null, failed: true };
      force((n) => n + 1);
    }
  } else if (query.data) {
    const required = query.data.applies && !query.data.complete;
    if (!settled.current || settled.current.required !== required || settled.current.status !== query.data || settled.current.failed) {
      settled.current = { required, status: query.data, failed: false };
      force((n) => n + 1);
    }
  }

  return {
    isLoading: !!employee && settled.current === null,
    gateRequired: Boolean(settled.current?.required),
    status: settled.current?.status ?? null,
    isError: Boolean(settled.current?.failed),
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
