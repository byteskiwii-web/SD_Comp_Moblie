import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { getHealthDeps, getKycStatus, isKycComplete, KycStatus } from '../api/verification.api';

export const kycGateQueryKey = (employeeId?: string) => ['kyc-gate', employeeId] as const;

type GateData = { verificationEnabled: false } | { verificationEnabled: true; kyc: KycStatus };

async function fetchKycGateStatus(): Promise<GateData> {
  let deps;
  try {
    deps = await getHealthDeps();
  } catch {
    // Can't even confirm enforcement is meant to be active -- fail OPEN,
    // matching the un-gated behaviour every employee has today.
    return { verificationEnabled: false };
  }
  if (deps.dependencies.verification !== 'enabled') {
    return { verificationEnabled: false };
  }
  // Verification is confirmed enabled from here on -- this call is
  // deliberately NOT wrapped in try/catch. Letting it throw gives
  // useQuery's `isError` one unambiguous meaning: "enforcement should
  // apply, but we couldn't confirm completion" -- i.e. fail CLOSED,
  // handled by the caller (the gate screen's error/retry state).
  const status = await getKycStatus();
  return { verificationEnabled: true, kyc: status.kyc };
}

/**
 * Mandatory KYC gate for field employees. Attendance stays hidden until
 * both PAN and Aadhaar read back verified -- but ONLY while verification is
 * actually enabled and reachable server-side. If it's disabled (today's
 * setting), every employee passes through exactly as before; the block
 * activates automatically the moment an operator turns verification on,
 * with no app change needed.
 *
 * Deliberately not persisted anywhere (unlike shiftStore's clocked-in hint,
 * which must survive app-kill to resume background location polling) --
 * KYC status is always re-fetched fresh, so a stale "complete" flag can
 * never linger in storage across app restarts.
 */
export function useKycGate() {
  const employee = useAuthStore((s) => s.employee);
  const isFieldEmployee = employee?.role === 'field-employee';

  const query = useQuery({
    queryKey: kycGateQueryKey(employee?.id),
    queryFn: fetchKycGateStatus,
    enabled: isFieldEmployee,
    // Retrying a 401 (an expired/invalid session) or a real outage a fixed
    // number of times just delays showing the error -- the screen's own
    // "Retry" button is the intended way to try again, not an automatic
    // background retry storm.
    retry: false,
  });

  // This app's QueryClient uses no focus-refetch wiring (App.tsx: defaults
  // only), so coming back from background needs the same explicit AppState
  // listener useShiftSync already uses, to catch KYC completed elsewhere
  // (e.g. by HR) while this screen sat idle.
  useEffect(() => {
    if (!isFieldEmployee) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') query.refetch();
    });
    return () => subscription.remove();
  }, [isFieldEmployee, query.refetch]);

  /**
   * The gate's open/closed decision is latched to the last SETTLED result,
   * not read live off query.isError/query.data.
   *
   * Why: RootNavigator and KycGateScreen both call this hook. The moment
   * gateRequired flips true, KycGateScreen mounts and (as any useQuery
   * subscriber does) triggers a background refetch of this same query --
   * which, while in flight, is neither erroed nor successful. Deriving
   * gateRequired straight from the live flags made it flip back to false
   * during that in-flight window, hiding the gate, which unmounted
   * KycGateScreen, which stopped the very fetch that would have proven the
   * gate was still needed -- an infinite open/closed/open oscillation.
   * Latching to the last settled attempt breaks that loop: an in-flight
   * refetch no longer changes what's on screen, only a completed one does.
   */
  const settledRef = useRef<{ gateRequired: boolean; kyc: KycStatus | null } | null>(null);
  const [, forceRender] = useState(0);

  if (query.isError) {
    if (!settledRef.current || settledRef.current.gateRequired !== true || settledRef.current.kyc !== null) {
      settledRef.current = { gateRequired: true, kyc: null };
      forceRender((n) => n + 1);
    }
  } else if (query.data) {
    const required = query.data.verificationEnabled === true && !isKycComplete(query.data.kyc);
    const kyc = query.data.verificationEnabled ? query.data.kyc : null;
    if (!settledRef.current || settledRef.current.gateRequired !== required || settledRef.current.kyc !== kyc) {
      settledRef.current = { gateRequired: required, kyc };
      forceRender((n) => n + 1);
    }
  }

  const hasSettledOnce = settledRef.current !== null;

  return {
    // Only the very first, never-yet-settled fetch should show a spinner --
    // a background refetch after that keeps showing the last known screen.
    isLoading: isFieldEmployee && !hasSettledOnce && query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    kyc: settledRef.current?.kyc ?? null,
    gateRequired: isFieldEmployee && Boolean(settledRef.current?.gateRequired),
    refetch: query.refetch,
  };
}
