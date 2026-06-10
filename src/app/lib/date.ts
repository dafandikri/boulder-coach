/**
 * Local-timezone calendar date as `YYYY-MM-DD`.
 *
 * Use this instead of `d.toISOString().slice(0, 10)` for any date *key* the user
 * thinks of as "today" — `toISOString()` is UTC, so before ~07:00 in UTC+7 it
 * reports yesterday, filing check-ins and logs under the wrong day (BC-02).
 */
export function localDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
