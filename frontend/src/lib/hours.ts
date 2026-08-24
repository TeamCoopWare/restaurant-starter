// =====================================================
// TRADING DAYS / OPENING HOURS
// Single source of truth for which weekdays the restaurant is closed, so the
// home page, menu and checkout all stay consistent. Evaluated in the
// restaurant's timezone (NEXT_PUBLIC_TIMEZONE, default Australia/Adelaide) so
// "closed today" flips at the right moment for every visitor, not their local
// midnight.
// =====================================================

// ⚠️ TESTING SWITCH. While true, EVERY day is treated as open AND all
// weekend-only items are orderable — so the site can be fully tested any day.
// SET TO false BEFORE REAL LAUNCH so the closed-days + weekend rules below apply.
export const TESTING_MODE = true;

// Weekday numbers the restaurant is CLOSED. 0=Sun,1=Mon,2=Tue,…,6=Sat.
// Sedap is closed Mondays & Tuesdays.
export const CLOSED_WEEKDAYS = [1, 2];

const TZ =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TIMEZONE) ||
  "Australia/Adelaide";

const SHORT_TO_NUM: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

// Current weekday (0–6) in the restaurant's timezone.
export function restaurantWeekday(d: Date = new Date()): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(d);
  return SHORT_TO_NUM[short] ?? d.getDay();
}

// Is the restaurant closed on the given day (default: now)?
export function isClosedToday(d: Date = new Date()): boolean {
  if (TESTING_MODE) return false;            // testing: never closed
  return CLOSED_WEEKDAYS.includes(restaurantWeekday(d));
}

// Human-readable trading-hours copy shown across the site.
export const CLOSED_DAYS_LABEL = "Closed Mondays & Tuesdays";
export const OPEN_DAYS_LABEL = "Open Wednesday – Sunday";
