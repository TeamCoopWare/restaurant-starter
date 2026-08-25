/* =====================================================
   PICKUP TIME SLOTS  (timezone-explicit)
   All wall-clock math is done in an explicit IANA time zone (e.g.
   Australia/Adelaide), never the server's local zone — the backend may run in
   UTC. `value` is the UTC datetime string Odoo stores in preset_time.
   generateSlots() is pure (takes `now`) so it can be unit-tested with a fixed
   clock.
===================================================== */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");

// Wall-clock parts of an instant, as seen in `timeZone`.
export function zonedParts(date, timeZone) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce((a, x) => ((a[x.type] = x.value), a), {});
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: p.hour === "24" ? 0 : +p.hour, minute: +p.minute, second: +p.second,
  };
}

// How far `timeZone` is ahead of UTC, in ms, at the given UTC instant.
function tzOffsetMs(utcMs, timeZone) {
  const p = zonedParts(new Date(utcMs), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

// UTC instant (ms) for a wall-clock time in `timeZone` (DST-safe).
export function zonedTimeToUtc(y, mo, d, h, mi, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const off1 = tzOffsetMs(guess, timeZone);
  let utc = guess - off1;
  const off2 = tzOffsetMs(utc, timeZone);
  if (off2 !== off1) utc = guess - off2; // refine across a DST boundary
  return utc;
}

export function generateSlots(now, timeZone, {
  interval = 20,          // minutes — matches Odoo POS takeout preset
  slotsAhead = 12,
  openMins = 10 * 60,     // 10:00 AM
  closeMins = 21 * 60,    // 9:00 PM
  nextDay = true,         // when false, only offer today's near-term slots
} = {}) {
  const nowParts = zonedParts(now, timeZone);
  const todayKey = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
  const minsNow = nowParts.hour * 60 + nowParts.minute;

  function makeSlot(y, mo, d, totalMins) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const u = new Date(zonedTimeToUtc(y, mo, d, h, m, timeZone));
    const odooDatetime =
      `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())} ` +
      `${pad(u.getUTCHours())}:${pad(u.getUTCMinutes())}:00`;

    const isToday = `${y}-${mo}-${d}` === todayKey;
    const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    const dayLabel = isToday ? "Today" : DAY_NAMES[dow];
    const ampm = h < 12 ? "AM" : "PM";
    const timeLabel = `${(h % 12) || 12}:${pad(m)} ${ampm}`;

    return { label: `${dayLabel} ${timeLabel}`, value: odooDatetime, localTime: `${pad(h)}:${pad(m)}`, day: dayLabel };
  }

  const slots = [];

  // Today — first slot is the next interval boundary at least `interval` mins out.
  const firstToday = Math.ceil((minsNow + interval) / interval) * interval;
  for (let mm = Math.max(firstToday, openMins); mm < closeMins && slots.length < slotsAhead; mm += interval) {
    slots.push(makeSlot(nowParts.year, nowParts.month, nowParts.day, mm));
  }

  // Not enough today → optionally fill from tomorrow (noon avoids DST edges).
  // Disabled for near-term-only mode so the kitchen never gets a far-future order.
  if (nextDay && slots.length < slotsAhead) {
    const tp = zonedParts(
      new Date(zonedTimeToUtc(nowParts.year, nowParts.month, nowParts.day, 12, 0, timeZone) + 24 * 3600 * 1000),
      timeZone
    );
    for (let mm = openMins; mm < closeMins && slots.length < slotsAhead; mm += interval) {
      slots.push(makeSlot(tp.year, tp.month, tp.day, mm));
    }
  }

  return { slots, interval };
}

// Trading sessions per weekday (0=Sun … 6=Sat), minutes from midnight (restaurant TZ).
// Keep in sync with frontend/src/lib/hours.ts SCHEDULE.
export const SESSIONS = {
  0: [{ start: 12 * 60, end: 19 * 60 + 30 }],                                   // Sun 12:00–19:30
  1: [],                                                                         // Mon closed
  2: [],                                                                         // Tue closed
  3: [{ start: 17 * 60, end: 21 * 60 + 30 }],                                   // Wed 17:00–21:30
  4: [{ start: 17 * 60, end: 21 * 60 + 30 }],                                   // Thu
  5: [{ start: 17 * 60, end: 21 * 60 + 30 }],                                   // Fri
  6: [{ start: 11 * 60, end: 14 * 60 + 30 }, { start: 17 * 60, end: 21 * 60 + 30 }], // Sat lunch + dinner
};

// Near-term pickup slots WITHIN the current trading session only. Returns no
// slots when closed or between sessions (no pre-open ordering). allDay=true
// (testing) removes the schedule so slots are always offered.
export function generateSessionSlots(now, timeZone, { interval = 20, slotsAhead = 12, allDay = false } = {}) {
  const p = zonedParts(now, timeZone);
  const minsNow = p.hour * 60 + p.minute;
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();

  let window = null;
  if (allDay) {
    window = { start: 0, end: 24 * 60 };
  } else {
    const sessions = SESSIONS[dow] || [];
    window = sessions.find((s) => minsNow >= s.start && minsNow < s.end) || null;
  }
  if (!window) return { slots: [], interval };

  const makeSlot = (totalMins) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const u = new Date(zonedTimeToUtc(p.year, p.month, p.day, h, m, timeZone));
    const odooDatetime =
      `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())} ` +
      `${pad(u.getUTCHours())}:${pad(u.getUTCMinutes())}:00`;
    const ampm = h < 12 ? "AM" : "PM";
    const timeLabel = `${(h % 12) || 12}:${pad(m)} ${ampm}`;
    return { label: `Today ${timeLabel}`, value: odooDatetime, localTime: `${pad(h)}:${pad(m)}`, day: "Today" };
  };

  const slots = [];
  const first = Math.ceil((minsNow + interval) / interval) * interval;
  for (let mm = Math.max(first, window.start); mm < window.end && slots.length < slotsAhead; mm += interval) {
    slots.push(makeSlot(mm));
  }
  return { slots, interval };
}
