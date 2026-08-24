/* Unit test for timezone-explicit pickup slots.
   Run: node test/slots.test.mjs
   Fakes a fixed UTC "now" and asserts the slots are Adelaide-local, regardless
   of the machine's own time zone. */
import assert from "node:assert/strict";
import { generateSlots, zonedTimeToUtc } from "../src/slots.js";

let failures = 0;
function check(name, fn) {
  try { fn(); console.log("✅", name); }
  catch (e) { failures++; console.error("❌", name, "\n   ", e.message); }
}

const TZ = "Australia/Adelaide";

/* July = Australian winter → Adelaide is UTC+9:30 (no DST).
   02:00:00Z  ==  11:30 AM Adelaide. */
check("July (UTC+9:30): first slot is 12:00 PM Adelaide == 02:30Z", () => {
  const now = new Date("2026-07-25T02:00:00Z");
  const { slots } = generateSlots(now, TZ);
  assert.ok(slots.length > 0, "expected slots");
  // minsNow=690 (11:30). next 20-min boundary ≥ +20 → 12:00 (720).
  assert.equal(slots[0].label, "Today 12:00 PM");
  assert.equal(slots[0].localTime, "12:00");
  assert.equal(slots[0].value, "2026-07-25 02:30:00"); // 12:00 Adelaide − 9:30
});

/* January = Australian summer → Adelaide is UTC+10:30 (DST).
   Same wall-clock 11:30 AM Adelaide happens at 01:00:00Z. */
check("January (UTC+10:30 DST): 12:00 PM Adelaide == 01:30Z", () => {
  const now = new Date("2026-01-15T01:00:00Z");
  const { slots } = generateSlots(now, TZ);
  assert.equal(slots[0].label, "Today 12:00 PM");
  assert.equal(slots[0].value, "2026-01-15 01:30:00"); // 12:00 Adelaide − 10:30
});

/* Before opening: at 20:00Z (≈ 05:30 AM Adelaide, winter) the first slot
   must be the 10:00 AM open, not an overnight time. */
check("pre-open clamps to 10:00 AM Adelaide open", () => {
  const now = new Date("2026-07-24T20:00:00Z"); // 05:30 AM Adelaide
  const { slots } = generateSlots(now, TZ);
  assert.equal(slots[0].label, "Today 10:00 AM");
  assert.equal(slots[0].value, "2026-07-25 00:30:00"); // 10:00 Adelaide − 9:30
});

/* Late at night rolls to tomorrow's open. 13:00Z Fri = 22:30 Adelaide (past
   9 PM close) → first slot is tomorrow (Sat) 10:00 AM. */
check("after close rolls to tomorrow's open with weekday label", () => {
  const now = new Date("2026-07-24T13:00:00Z"); // Fri 22:30 Adelaide
  const { slots } = generateSlots(now, TZ);
  assert.equal(slots[0].label, "Sat 10:00 AM");
  assert.equal(slots[0].value, "2026-07-25 00:30:00");
});

check("near-term mode: caps to slotsAhead and never fills next day", () => {
  // Mid-afternoon Adelaide, plenty of time before close.
  const now = new Date("2026-07-25T04:00:00Z"); // 13:30 Sat Adelaide
  const { slots } = generateSlots(now, TZ, { slotsAhead: 4, nextDay: false });
  assert.equal(slots.length, 4, "should offer exactly 4 near-term slots");
  assert.ok(slots.every((s) => s.day === "Today"), "all slots must be today");
});

check("near-term mode: near close returns only the remaining slots (no tomorrow)", () => {
  const now = new Date("2026-07-25T10:50:00Z"); // 20:20 Sat Adelaide (close 21:00)
  const { slots } = generateSlots(now, TZ, { slotsAhead: 4, nextDay: false });
  // Only 20:40 fits before 21:00 close; must NOT roll to tomorrow.
  assert.ok(slots.length <= 1, `expected <=1 slot, got ${slots.length}`);
  assert.ok(slots.every((s) => s.day === "Today"), "no next-day slots allowed");
});

check("zonedTimeToUtc round-trips a winter Adelaide wall time", () => {
  const utc = new Date(zonedTimeToUtc(2026, 7, 25, 12, 0, TZ));
  assert.equal(utc.toISOString(), "2026-07-25T02:30:00.000Z");
});

console.log(failures ? `\n${failures} test(s) FAILED` : "\nAll slot tests passed");
process.exit(failures ? 1 : 0);
