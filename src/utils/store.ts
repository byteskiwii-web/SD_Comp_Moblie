/**
 * How a store is named on screen: "Ahmedabad-Devarc (A004)".
 *
 * The code is what HR, the register and every export key off, and what
 * somebody reads out on the phone when a punch is queried -- so it belongs
 * beside the name everywhere the name appears, not only on the pages that
 * happened to include it. One function so the two halves cannot drift into
 * "A004 · Name" here and "Name - A004" there.
 */
export function storeLabel(
  store: { name?: string | null; store_code?: string | null } | null | undefined,
  fallback = '—'
): string {
  const name = store?.name?.trim() || '';
  const code = store?.store_code?.trim() || '';
  if (name && code) return `${name} (${code})`;
  return name || code || fallback;
}
