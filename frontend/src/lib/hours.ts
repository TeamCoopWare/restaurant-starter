// =====================================================
// TRADING SCHEDULE  (single source of truth)
// Weekday: 0=Sun … 6=Sat. Times "HH:MM" in the restaurant timezone.
// menu: "full"   = whole menu EXCEPT Banana Leaf
//       "banana" = Banana Leaf ONLY
//       "lunch"  = "full" minus the items in LUNCH_EXCLUDED_* below
// Evaluated in NEXT_PUBLIC_TIMEZONE (default Australia/Adelaide) so it flips at
// the right wall-clock moment for every visitor.
// =====================================================

export type MenuMode = "full" | "banana" | "lunch";
export interface Session { start: string; end: string; menu: MenuMode }

export const SCHEDULE: Record<number, Session[]> = {
  0: [{ start: "12:00", end: "19:30", menu: "full" }],                 // Sunday
  1: [],                                                               // Monday   — closed
  2: [],                                                               // Tuesday  — closed
  3: [                                                                 // Wednesday
    { start: "12:00", end: "15:00", menu: "lunch" },                   //   lunch  — full menu minus a few items
    { start: "17:00", end: "21:30", menu: "full" },                    //   dinner — full menu
  ],
  4: [                                                                 // Thursday
    { start: "12:00", end: "15:00", menu: "lunch" },
    { start: "17:00", end: "21:30", menu: "full" },
  ],
  5: [                                                                 // Friday
    { start: "12:00", end: "15:00", menu: "lunch" },
    { start: "17:00", end: "21:30", menu: "full" },
  ],
  6: [                                                                 // Saturday
    { start: "11:00", end: "14:30", menu: "banana" },                  //   lunch  — Banana Leaf only
    { start: "17:00", end: "21:30", menu: "full" },                    //   dinner — full menu, no Banana Leaf
  ],
};

// ⚠️ TESTING: set to "full" or "banana" to force an open session on ANY day/time
// (so the site can be tested off-hours). null = use the real SCHEDULE above.
// MUST be null for real launch.
export const FORCE_SESSION: MenuMode | null = null;

const TZ =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TIMEZONE) ||
  "Australia/Adelaide";
const SHORT_TO_NUM: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const toMins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

function nowInTz(d: Date = new Date()): { weekday: number; mins: number } {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce((a: any, x) => ((a[x.type] = x.value), a), {});
  const weekday = SHORT_TO_NUM[p.weekday] ?? d.getDay();
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  return { weekday, mins: hour * 60 + Number(p.minute) };
}

// A forced mode for testing: the FORCE_SESSION constant, or a `?force=` URL
// param (full | banana | lunch | closed). Returns null to use the real SCHEDULE.
// The URL param only affects what THIS browser sees — the backend still enforces
// real hours for pickup slots + order creation, so it can't be abused to order
// when actually closed.
function forcedMode(): MenuMode | "closed" | null {
  if (FORCE_SESSION) return FORCE_SESSION;
  if (typeof window !== "undefined") {
    const f = new URLSearchParams(window.location.search).get("force");
    if (f === "full" || f === "banana" || f === "lunch" || f === "closed") return f;
  }
  return null;
}

// The session we're currently inside, or null when closed.
export function currentSession(d: Date = new Date()): Session | null {
  const f = forcedMode();
  if (f === "closed") return null;
  if (f) return { start: "00:00", end: "23:59", menu: f };
  const { weekday, mins } = nowInTz(d);
  for (const s of SCHEDULE[weekday] || []) {
    if (mins >= toMins(s.start) && mins < toMins(s.end)) return s;
  }
  return null;
}

export function isOpenNow(d: Date = new Date()): boolean { return currentSession(d) !== null; }
export function currentMenuMode(d: Date = new Date()): MenuMode | null {
  return currentSession(d)?.menu ?? null;
}

// An item is part of the Banana Leaf offering: the Set, or its protein add-on
// named "Add On (Extra)". NOT the general dish add-ons like "Chicken (Add-on)".
export function isBananaLeafItem(title?: string): boolean {
  const t = (title ?? "").toLowerCase();
  return t.includes("banana leaf") || t.includes("add on (extra)");
}

/* =====================================================
   WEEKDAY LUNCH  (Wed–Fri 12–3pm)
   Same menu as dinner, minus the items below. Odoo ids are the authority;
   the title list only catches items that aren't live in Odoo and so have no
   id to match on. Adding a new dessert in Odoo is covered automatically on
   the website (category check) but NOT on the server — add its id to
   LUNCH_BLOCKED_PRODUCT_IDS in backend/src/index.js too.
===================================================== */
export const LUNCH_EXCLUDED_CATEGORIES = new Set(["Dessert"]);
export const LUNCH_EXCLUDED_ODOO_IDS = new Set<number>([
  9,   // Cucuk Udang
  38,  // Ice Kacang   (Dessert)
  39,  // Buko Pandan  (Dessert)
]);
export const LUNCH_EXCLUDED_TITLES = ["cucuk udang", "starter sampler"];

export function isLunchExcluded(item: {
  title?: string;
  category?: string;
  odooProductId?: number | null;
}): boolean {
  if (item.odooProductId && LUNCH_EXCLUDED_ODOO_IDS.has(item.odooProductId)) return true;
  if (LUNCH_EXCLUDED_CATEGORIES.has(item.category ?? "")) return true;
  const t = (item.title ?? "").toLowerCase();
  return LUNCH_EXCLUDED_TITLES.some((k) => t.includes(k));
}

// Human-readable trading hours shown across the site.
export const HOURS_SUMMARY =
  "Wed–Fri 12–3pm & 5–9:30pm · Sat 11am–2:30pm (Banana Leaf) & 5–9:30pm · Sun 12–7:30pm · Closed Mon & Tue";
