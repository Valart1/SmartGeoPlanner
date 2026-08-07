/**
 * dateUtils
 *
 * Helpers for working with calendar dates (YYYY-MM-DD) and times (HH:MM) in
 * the user's *local* timezone.
 *
 * Why not `new Date().toISOString().split('T')[0]`?
 * `toISOString()` always returns a UTC timestamp. For anyone in a timezone
 * west of UTC (e.g. any American timezone), that can yield *yesterday's*
 * date late in the evening. These helpers build the YYYY-MM-DD string from
 * the local components, so the displayed/saved date always matches what the
 * user sees on their clock.
 */

/**
 * Returns today's date as a YYYY-MM-DD string in the local timezone.
 */
export function todayString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats a YYYY-MM-DD string for display, without timezone shifting.
 * `new Date('2026-07-21')` is parsed as UTC midnight by the spec, so
 * `toLocaleDateString` would shift the day for anyone in a negative-offset
 * timezone. We build the formatted string from the YYYY-MM-DD components
 * directly so the displayed date is always exactly what was stored.
 */
export function formatCalendarDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale: string = 'en-US',
): string {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  // Construct as a local-time Date so toLocaleDateString uses local rules
  // (weekday, month names) without any UTC shift.
  const local = new Date(y, m - 1, d, 12, 0, 0);
  return local.toLocaleDateString(locale, options);
}

/**
 * Normalizes a date-like value to a YYYY-MM-DD string in the local timezone.
 * Accepts ISO strings, Date objects, or already-formatted YYYY-MM-DD strings.
 *
 * Why not `value.toISOString().split('T')[0]`?
 * For Date objects that come from the database (PostgreSQL returns DATE
 * columns as a JS Date at *UTC* midnight, e.g. `2026-07-21T00:00:00.000Z`),
 * going through `toISOString()` and then extracting the date would shift the
 * day in any timezone west of UTC. We use UTC components instead so the
 * calendar date is preserved regardless of the user's timezone.
 */
export function toLocalDateString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // String input: keep the date portion (YYYY-MM-DD) untouched so we never
  // shift a YYYY-MM-DD string into a different day due to UTC conversion.
  return String(value).split('T')[0];
}
