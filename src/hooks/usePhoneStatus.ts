import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { getPhoneStatus, type PhoneStatus } from '../api/devices.api';

export const phoneStatusQueryKey = (employeeId: string | undefined) => ['phone-status', employeeId] as const;

/**
 * Where this phone stands for the signed-in employee (backend:
 * modules/devices/phone.service.js#status). Fetched once the app opens -- which
 * is also when a phone that has no key is given one -- and again whenever the
 * app comes back to the foreground, so an HR decision shows without a restart.
 * Shared by the punch panel and Profile through one cache entry.
 */
export function usePhoneStatus() {
  const employeeId = useAuthStore((s) => s.employee?.id);
  return useQuery({
    queryKey: phoneStatusQueryKey(employeeId),
    queryFn: getPhoneStatus,
    enabled: !!employeeId && (Platform.OS === 'android' || Platform.OS === 'ios'),
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * Whether punching from this phone would be refused: only when the server
 * enforces, and only for another phone or another employee's phone. An
 * unknown status (offline, still loading) never blocks -- the server still
 * decides at the punch.
 */
export function isPhoneBlocked(status: PhoneStatus | undefined): boolean {
  return status?.mode === 'enforce' && (status.state === 'other-phone' || status.state === 'other-employee');
}

/** Whether the phone check applies to this employee at all. */
export function phoneCheckApplies(status: PhoneStatus | undefined): boolean {
  return !!status && status.mode !== 'off' && status.state !== 'exempt';
}
