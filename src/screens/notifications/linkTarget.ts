/**
 * Where a notification's `linkPath` goes on this device.
 *
 * The server writes one path per event and both clients read it, but they do
 * not have the same screens: the console has /offers/<id> and /employees/<id>,
 * this app does not. So the mapping lives here, on the client that knows its
 * own navigator, and anything unrecognised resolves to null rather than
 * guessing.
 *
 * A null target is a normal outcome, not an error — an HR-only notification
 * legitimately has nowhere to go on a field employee's phone. The row still
 * shows and still marks read; it just does not pretend to be a link.
 */

/** A tab, and optionally a screen within that tab's stack. */
export type LinkTarget = { tab: string; screen?: string; params?: Record<string, unknown> };

/**
 * Paths are matched on their route part only; query strings are carried by the
 * emitting service for the console's benefit (`/attendance-alerts?id=…`) and
 * mean nothing to a navigator that has no such screen.
 */
export function resolveLinkTarget(linkPath: string | null | undefined): LinkTarget | null {
  if (!linkPath) return null;
  const route = String(linkPath).split('?')[0].replace(/\/+$/, '');

  switch (route) {
    case '/attendance':
    case '/attendance-alerts':
      return { tab: 'Attendance' };

    case '/leave':
      return { tab: 'Leave' };

    // Both live as cards on Home: policies are acknowledged inline in
    // PoliciesCard, and appreciation is read in AppreciationCard. Landing on
    // Home IS arriving at them, so there is no deeper screen to push.
    case '/policies':
    case '/appreciation':
      return { tab: 'Home' };

    default:
      // /offers/<id> and /employees/<id> are console destinations. A field
      // employee can receive neither today, but saying so explicitly beats a
      // navigator throwing on an unknown route name if that ever changes.
      return null;
  }
}
