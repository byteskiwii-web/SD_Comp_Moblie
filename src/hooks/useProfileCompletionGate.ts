import { useAuthStore } from '../stores/authStore';

/**
 * "Complete your profile" gate for a newly hired field employee or team
 * lead. HR creates the account with only identity and posting filled in
 * (employee_details.approval_status starts 'pending-approval' unless the
 * creating actor can self-approve — see the backend's roleCanSelfApprove).
 * This gate is what asks the employee themselves for the rest: date of
 * birth, address, and documents once Drive storage is switched on.
 *
 * Requires BOTH approvalStatus === 'pending-approval' AND the required
 * fields still missing -- neither alone is safe. Fields-only would catch
 * every pre-existing account with no address on file (most of them) the
 * moment this ships, since approvalStatus wasn't even being read before
 * this feature. Status-only would show this screen every time a pending
 * employee opens the app until an HR reviewer gets to the approval queue,
 * regardless of what they already submitted -- the opposite of "sign up
 * once". Submitting the missing fields is what clears the gate; HR's
 * approve/reject decision (the web admin's EmployeeDetailPage already
 * carries that banner) is a real step that happens in the background and
 * is not what unblocks the rest of the app here.
 *
 * Scoped to field-employee and team-lead: nobody else is created this way
 * today (HR/admin/manager accounts are provisioned by other HR staff who
 * already know their own details when they set the account up).
 */
export function useProfileCompletionGate() {
  const employee = useAuthStore((s) => s.employee);
  const profile = useAuthStore((s) => s.profile);

  const eligibleRole = employee?.role === 'field-employee' || employee?.role === 'team-lead';

  const isComplete = Boolean(
    profile?.dateOfBirth &&
      profile?.addressLine1 &&
      profile?.city &&
      profile?.state &&
      profile?.zipcode
  );

  /*
   * pending-approval is REQUIRED here, not just "fields incomplete" --
   * this is the one thing standing between this gate and locking every
   * existing employee out of the app the moment this ships. Migration
   * 020 backfilled every account that predates approval tracking to
   * 'approved', but plenty of those real accounts have no address on
   * file and never will unless someone asks them for one. Without the
   * pending-approval check, isComplete alone would read `false` for
   * every one of them and this gate would swallow the whole app.
   * pending-approval only happens two ways: a fresh HR-created account
   * (the case this gate exists for), or a genuinely un-migrated row --
   * and a backend not carrying approvalStatus at all yet reads as
   * `null` here, which fails this check and leaves the gate closed, the
   * same safe direction.
   */
  const needsCompletion = profile?.approvalStatus === 'pending-approval' && !isComplete;

  return {
    // profile is null only until the fire-and-forget refresh in
    // setAuth/hydrate lands -- brief, but real, so the caller gets a
    // moment to show a spinner instead of flashing the main app first.
    isLoading: eligibleRole && profile === null,
    gateRequired: Boolean(eligibleRole && profile && needsCompletion),
  };
}
