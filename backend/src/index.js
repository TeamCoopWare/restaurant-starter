import express from "express";
import cors from "cors";
import "dotenv/config";
import Stripe from "stripe";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { generateSlots, generateSessionSlots } from "./slots.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Behind one reverse proxy in production (order subdomain) — so req.ip reads
// the real client IP from X-Forwarded-For for rate limiting.
app.set("trust proxy", 1);

const {
  ODOO_URL = "http://localhost:8069",
  ODOO_DB,
  ODOO_USERNAME,
  ODOO_PASSWORD,
  ODOO_API_KEY,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_ONLINE_PM_ID,
  FRONTEND_URL = "http://localhost:3000",
  PORT = 4000,
  API_KEY,
  ADMIN_KEY,
  ALLOWED_ORIGINS,
  TIMEZONE = "Australia/Adelaide",
} = process.env;

// Odoo POS "Takeout" preset id (instance-specific → env-configurable).
const PRESET_ID = Number(process.env.PRESET_ID || 2);

// Odoo tax id for the public-holiday surcharge (env-configurable).
const HOLIDAY_TAX_ID = Number(process.env.HOLIDAY_TAX_ID || 39);

// How many near-term pickup slots to offer (kept small so the kitchen never
// receives a far-future order — food is always made close to pickup).
const SLOTS_AHEAD = Number(process.env.SLOTS_AHEAD || 4);

/* Required env — fail loudly at startup if any are missing, so a
   misconfigured deploy never silently half-works. */
function validateEnv() {
  const required = [
    "ODOO_URL", "ODOO_DB", "ODOO_USERNAME", "ODOO_PASSWORD",
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "API_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("❌ FATAL — missing required env var(s): " + missing.join(", "));
    console.error("   See backend/.env.example for the full list.");
    process.exit(1);
  }
}

/* =====================================================
   HOLIDAY SURCHARGE STATE — persisted to disk so a backend restart during a
   holiday doesn't silently drop the surcharge. The POS module sets it via
   POST /api/holiday/toggle; checkout/quote pricing reads it.
===================================================== */
const HOLIDAY_STATE_FILE = path.join(__dirname, "..", "holiday-state.json");

function loadHolidayState() {
  try {
    return !!JSON.parse(fs.readFileSync(HOLIDAY_STATE_FILE, "utf8")).active;
  } catch {
    return false;
  }
}
function saveHolidayState(active) {
  try {
    fs.writeFileSync(HOLIDAY_STATE_FILE, JSON.stringify({ active }, null, 2));
  } catch (e) {
    console.error("⚠️  Could not persist holiday state:", e.message);
  }
}
let holidaySurchargeActive = loadHolidayState();

/* =====================================================
   HIDDEN MENU ITEMS — the owner's "sold out" switch, set from the website's
   /admin page. A set of Odoo product_ids that must not appear on the menu and
   must not be orderable. Persisted to disk (same reasoning as the holiday
   flag: a restart must not silently put a sold-out dish back on sale).
   Deliberately kept OUT of Odoo so the owner never has to touch the POS admin.
===================================================== */
const HIDDEN_STATE_FILE = path.join(__dirname, "..", "hidden-items.json");

function loadHiddenItems() {
  try {
    const raw = JSON.parse(fs.readFileSync(HIDDEN_STATE_FILE, "utf8"));
    return new Set((raw.hidden || []).map(Number).filter(Number.isInteger));
  } catch {
    return new Set();
  }
}
function saveHiddenItems(set) {
  try {
    fs.writeFileSync(
      HIDDEN_STATE_FILE,
      JSON.stringify({ hidden: [...set].sort((a, b) => a - b) }, null, 2)
    );
  } catch (e) {
    console.error("⚠️  Could not persist hidden items:", e.message);
  }
}
let hiddenItems = loadHiddenItems();

/* Strip hidden variants from an Odoo /api/menu payload. A group whose every
   variant is hidden disappears entirely. Returns a new array — never mutates
   the upstream response. */
function stripHiddenFromMenu(groups) {
  const out = [];
  for (const g of groups || []) {
    const variants = (g.variants || []).filter((v) => !hiddenItems.has(Number(v.product_id)));
    if (variants.length) out.push({ ...g, variants });
  }
  return out;
}

if (!STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY not set — checkout will fail");
}
if (!STRIPE_WEBHOOK_SECRET) {
  console.warn("⚠️  STRIPE_WEBHOOK_SECRET not set — /webhook will reject all events");
}
if (!API_KEY) {
  console.warn("⚠️  API_KEY not set — protected endpoints will reject all requests");
}

// Resolved at startup (Stripe Online POS payment method). Never falls back to Cash.
let stripeOnlinePmId = null;

/* Session id → order outcome, so the read-only success page can poll status.
   In-memory: sufficient for staging; a production deployment should persist this
   (and de-dupe webhook retries) in a store that survives restarts. */
const orderStatusBySession = new Map();
const processedSessions = new Set();

/* =====================================================
   CORS — restrict to an env-configured origin allow-list.
   ALLOWED_ORIGINS is a comma-separated list; if unset we
   fall back to FRONTEND_URL so local dev keeps working.
   Requests with no Origin header (curl, server-to-server)
   are allowed — CORS only guards browser cross-origin calls.
===================================================== */
const allowedOrigins = (ALLOWED_ORIGINS || FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // non-browser client
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  })
);

/* Stripe webhook needs the RAW request body for signature verification, so it
   must be registered with express.raw BEFORE the global JSON parser runs. */
app.post("/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

app.use(express.json());

/* =====================================================
   SHARED-SECRET AUTH
   Protected endpoints require header X-Api-Key === API_KEY.
   Public endpoints (menu, status, timeslots) stay open.
===================================================== */
function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return res
      .status(503)
      .json({ error: "Server auth not configured (API_KEY missing)" });
  }
  const provided = req.get("X-Api-Key");
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/* Separate secret for the website's /admin page. Deliberately NOT API_KEY:
   that one is the POS bridge's secret and must never be typed into a browser
   or stored in localStorage. If ADMIN_KEY is unset the admin endpoints are
   closed rather than open. */
function requireAdminKey(req, res, next) {
  if (!ADMIN_KEY) {
    return res
      .status(503)
      .json({ error: "Admin not configured (ADMIN_KEY missing on the server)" });
  }
  const provided = req.get("X-Admin-Key");
  if (!provided || provided !== ADMIN_KEY) {
    return res.status(401).json({ error: "Wrong admin password" });
  }
  next();
}

/* =====================================================
   RATE LIMITING (in-memory, per IP) for the public POST endpoints.
   Generous café-scale limits — just enough to blunt abuse/loops. Returns 429
   with Retry-After. Not a distributed limiter; fine for a single backend.
===================================================== */
function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip -> [timestamps within window]
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Too many requests — please slow down and try again shortly.",
      });
    }
    recent.push(now);
    hits.set(ip, recent);
    if (recent.length === 0) hits.delete(ip); // keep the map from growing unbounded
    next();
  };
}

// Café-scale: quote is hit on every cart change; checkout much less often.
const quoteLimiter    = rateLimit({ windowMs: 60_000, max: 60 });
const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 15 });

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const odooHeaders = {
  "Content-Type": "application/json",
  ...(ODOO_API_KEY && { Authorization: `Bearer ${ODOO_API_KEY}` }),
};

/* =====================================================
   ODOO JSON-RPC HELPERS
===================================================== */
async function odooAuthenticate() {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: 1,
      params: {
        service: "common", method: "authenticate",
        args: [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}],
      },
    }),
  });
  const { result: uid } = await res.json();
  if (!uid) throw new Error("Odoo authentication failed");
  return uid;
}

async function odooCall(uid, model, method, args, kwargs = {}) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: 2,
      params: {
        service: "object", method: "execute_kw",
        args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargs],
      },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || "Odoo RPC error");
  return data.result;
}

/* =====================================================
   FIND OR CREATE CUSTOMER PARTNER IN ODOO
   So customer name + phone appear on the POS order.
===================================================== */
async function findOrCreatePartner(uid, name, phone) {
  // Search by phone first
  const existing = await odooCall(uid, "res.partner", "search_read",
    [[["phone", "=", phone]]],
    { fields: ["id", "name", "phone"], limit: 1 }
  );
  if (existing.length) {
    console.log("👤 Found existing partner:", existing[0].name, "(id:", existing[0].id + ")");
    return existing[0].id;
  }

  // Create new partner
  const partnerId = await odooCall(uid, "res.partner", "create", [{
    name,
    phone,
    customer_rank: 1,
  }]);
  console.log("👤 Created new partner:", name, phone, "(id:", partnerId + ")");
  return partnerId;
}

/* =====================================================
   RESOLVE "Stripe Online" POS PAYMENT METHOD (at startup)
   Order of preference:
     1. STRIPE_ONLINE_PM_ID env override.
     2. Exact name match  [["name","=","Stripe Online"]].
     3. Case-insensitive  [["name","ilike","stripe online"]]  (name is
        translatable in Odoo 19, so exact match can miss).
   If none resolve, we FAIL LOUDLY — never fall back to Cash.
===================================================== */
async function resolveStripeOnlinePmId() {
  if (STRIPE_ONLINE_PM_ID) {
    const id = Number(STRIPE_ONLINE_PM_ID);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`STRIPE_ONLINE_PM_ID is not a valid id: ${STRIPE_ONLINE_PM_ID}`);
    }
    return id;
  }
  const uid = await odooAuthenticate();
  let methods = await odooCall(uid, "pos.payment.method", "search_read",
    [[["name", "=", "Stripe Online"]]],
    { fields: ["id", "name"], limit: 1 }
  );
  if (!methods.length) {
    methods = await odooCall(uid, "pos.payment.method", "search_read",
      [[["name", "ilike", "stripe online"]]],
      { fields: ["id", "name"], limit: 1 }
    );
  }
  if (!methods.length) {
    throw new Error(
      'POS payment method "Stripe Online" not found in Odoo. ' +
      "Create it in Point of Sale, or set STRIPE_ONLINE_PM_ID."
    );
  }
  return methods[0].id;
}

/* =====================================================
   SERVER-SIDE PRICING (source of truth = Odoo)
   Re-reads lst_price + taxes_id for each product_id and uses Odoo's own
   account.tax.compute_all to derive tax-exclusive/inclusive line amounts —
   matching exactly how POS counter orders are priced. Client-sent prices are
   ignored (used only for the pre-payment display in the browser).

   When applyHoliday is true (POS holiday toggle on), HOLIDAY_TAX_ID is added
   alongside each product's own taxes_id — producing the same surcharged line
   shape (tax_ids incl. 39) as a POS order rung up with the surcharge button.

   items: [{ product_id, qty }]  →  returns:
     { orderLines, amountTotal, amountTax, pricedItems, breakdown }
   breakdown = { subtotal, gst, holiday_surcharge, total, holiday_applied }
===================================================== */
async function priceOrderFromOdoo(uid, items, { applyHoliday = false } = {}) {
  const clean = (items || [])
    .map((i) => ({ product_id: Number(i.product_id), qty: Number(i.qty) }))
    .filter((i) => Number.isInteger(i.product_id) && i.product_id > 0 && i.qty > 0);

  if (!clean.length) throw new Error("Cart is empty or has no valid items");

  const ids = [...new Set(clean.map((i) => i.product_id))];
  const products = await odooCall(uid, "product.product", "read",
    [ids],
    { fields: ["id", "name", "lst_price", "taxes_id", "active", "available_in_pos"] }
  );
  const byId = new Map(products.map((p) => [p.id, p]));

  const orderLines = [];
  const pricedItems = [];
  let amountTotal = 0;
  let gstAmount = 0;
  let holidayAmount = 0;

  for (const item of clean) {
    const p = byId.get(item.product_id);
    if (!p) throw new Error(`Product ${item.product_id} not found in Odoo`);
    if (!p.active || !p.available_in_pos) {
      throw new Error(`Product ${item.product_id} (${p.name}) is not available for sale`);
    }
    /* Switched off by the owner in /admin. Checked here as well as in
       /api/menu because the frontend keeps a localStorage menu cache
       ("sedap_menu_cache") — a stale cache must never stay orderable. */
    if (hiddenItems.has(item.product_id)) {
      throw new Error(`Sorry, ${p.name} is sold out — please remove it from your cart`);
    }

    const unitPrice = p.lst_price;            // authoritative POS price (variant extras included)
    const baseTaxes = p.taxes_id || [];
    const taxIds = applyHoliday
      ? [...new Set([...baseTaxes, HOLIDAY_TAX_ID])]   // dedupe if already present
      : baseTaxes;

    // Let Odoo compute the taxes exactly as the POS does.
    const t = await odooCall(uid, "account.tax", "compute_all",
      [taxIds, unitPrice, false, item.qty, false, false]
    );
    const lineExcl = Math.round(t.total_excluded * 100) / 100;
    const lineIncl = Math.round(t.total_included * 100) / 100;

    // Split this line's tax into holiday surcharge vs. everything else (GST).
    let lineHoliday = 0;
    for (const tx of t.taxes || []) {
      if (tx.id === HOLIDAY_TAX_ID) { lineHoliday += tx.amount; holidayAmount += tx.amount; }
      else                         { gstAmount += tx.amount; }
    }
    lineHoliday = Math.round(lineHoliday * 100) / 100;

    orderLines.push([0, 0, {
      product_id:          item.product_id,
      qty:                 item.qty,
      price_unit:          unitPrice,
      price_subtotal:      lineExcl,
      price_subtotal_incl: lineIncl,
      discount:            0,
      tax_ids:             [[6, 0, taxIds]],
    }]);

    pricedItems.push({
      product_id: item.product_id,
      name:       p.name,
      qty:        item.qty,
      lineIncl,
      lineHoliday,                         // surcharge portion baked into lineIncl
    });

    amountTotal += lineIncl;
  }

  const total            = Math.round(amountTotal * 100) / 100;
  const holiday_surcharge = Math.round(holidayAmount * 100) / 100;
  const gst              = Math.round(gstAmount * 100) / 100;
  const subtotal         = Math.round((total - holiday_surcharge) * 100) / 100;

  return {
    orderLines,
    amountTotal: total,
    amountTax:   Math.round((gstAmount + holidayAmount) * 100) / 100,
    pricedItems,
    breakdown:   { subtotal, gst, holiday_surcharge, total, holiday_applied: applyHoliday },
  };
}

/* =====================================================
   HEALTH CHECK
===================================================== */
app.get("/health", (req, res) => {
  res.json({ status: "ok", backend: "running" });
});

/* =====================================================
   MENU PROXY  →  GET /api/menu
===================================================== */
app.get("/api/menu", async (req, res) => {
  try {
    const r = await fetch(`${ODOO_URL}/api/menu`, { headers: odooHeaders });
    if (!r.ok) throw new Error(`Odoo returned ${r.status}`);
    const data = await r.json();
    // Hide anything the owner switched off in /admin. Done here (not just in
    // the browser) so a customer genuinely cannot see a sold-out item.
    res.json(stripHiddenFromMenu(data));
  } catch (err) {
    console.error("❌ Menu proxy error:", err.message);
    res.status(502).json({ error: "Odoo menu unavailable" });
  }
});

/* =====================================================
   PRODUCT IMAGE PROXY  →  GET /api/product-image/:templateId
   Streams the Odoo product image through the backend so the Odoo host is
   never exposed to the browser. 404 → the frontend falls back to a placeholder.
===================================================== */
app.get("/api/product-image/:templateId", async (req, res) => {
  const id = Number(req.params.templateId);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).end();
  try {
    const r = await fetch(
      `${ODOO_URL}/web/image/product.template/${id}/image_128`,
      { headers: odooHeaders }
    );
    if (!r.ok) return res.status(r.status).end();
    res.set("Content-Type", r.headers.get("content-type") || "image/png");
    res.set("Cache-Control", "public, max-age=3600");
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error("❌ Image proxy error:", err.message);
    res.status(502).end();
  }
});

/* =====================================================
   TIME SLOTS  →  GET /api/timeslots
   Pickup slots computed in TIMEZONE (never the server's local zone).
   `value` is the UTC datetime Odoo stores in preset_time.
===================================================== */
app.get("/api/timeslots", (req, res) => {
  try {
    // Near-term only: the next few slots today, no next-day fill.
    // SLOTS_ALLDAY=1 (TESTING) removes the 10am–9pm opening-hours window so
    // pickup slots are always available regardless of the current time.
    // Remove it (or set to 0) for real launch.
    const allDay = process.env.SLOTS_ALLDAY === "1";
    res.json(generateSessionSlots(new Date(), TIMEZONE, {
      slotsAhead: SLOTS_AHEAD,
      allDay,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================
   POS STATUS  →  GET /api/pos-status
   Returns whether a POS session is currently open.
===================================================== */
app.get("/api/pos-status", async (req, res) => {
  try {
    const uid = await odooAuthenticate();
    const sessions = await odooCall(uid, "pos.session", "search_read",
      [[["state", "=", "opened"]]],
      { fields: ["id", "name"], limit: 1 }
    );
    res.json({ open: sessions.length > 0 });
  } catch (err) {
    res.json({ open: false });
  }
});

/* =====================================================
   ADMIN: SHOW / HIDE MENU ITEMS   (website /admin page)
   Both routes need header X-Admin-Key. The owner never touches Odoo or the POS.
===================================================== */

// GET /api/admin/menu — the FULL menu (hidden items included) plus the hidden
// id list, so the admin page can list everything and switch things back on.
app.get("/api/admin/menu", requireAdminKey, async (req, res) => {
  try {
    const r = await fetch(`${ODOO_URL}/api/menu`, { headers: odooHeaders });
    if (!r.ok) throw new Error(`Odoo returned ${r.status}`);
    res.json({ groups: await r.json(), hidden: [...hiddenItems] });
  } catch (err) {
    console.error("❌ Admin menu error:", err.message);
    res.status(502).json({ error: "Menu unavailable" });
  }
});

// POST /api/admin/hidden — flip one item, or replace the whole list.
//   { product_id: 42, hidden: true }   → hide (or show) a single item
//   { hidden: [42, 43] }               → replace the entire list
app.post("/api/admin/hidden", requireAdminKey, (req, res) => {
  const { product_id, hidden } = req.body || {};

  if (Array.isArray(hidden)) {
    hiddenItems = new Set(hidden.map(Number).filter(Number.isInteger));
  } else if (product_id != null) {
    const id = Number(product_id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "product_id must be a positive integer" });
    }
    // Explicit boolean wins; otherwise just toggle the current state.
    const shouldHide = typeof hidden === "boolean" ? hidden : !hiddenItems.has(id);
    if (shouldHide) hiddenItems.add(id);
    else hiddenItems.delete(id);
  } else {
    return res.status(400).json({ error: "Send { product_id, hidden } or { hidden: [ids] }" });
  }

  saveHiddenItems(hiddenItems);
  console.log("👁️  Hidden items:", hiddenItems.size, "→", [...hiddenItems].join(", ") || "(none)");
  res.json({ hidden: [...hiddenItems] });
});

/* =====================================================
   HOLIDAY SURCHARGE STATE  (state loaded from disk at startup — see top)
   POS module calls toggle, website reads status.
===================================================== */
// GET /api/holiday/status — website reads this
app.get("/api/holiday/status", (req, res) => {
  res.json({ active: holidaySurchargeActive });
});

// POST /api/holiday/toggle — POS calls this when button is toggled
app.post("/api/holiday/toggle", requireApiKey, (req, res) => {
  const { active } = req.body;
  holidaySurchargeActive = typeof active === "boolean" ? active : !holidaySurchargeActive;
  saveHolidayState(holidaySurchargeActive);   // persist so it survives restarts
  console.log("🎌 Holiday surcharge:", holidaySurchargeActive ? "ON" : "OFF", "(persisted)");
  res.json({ active: holidaySurchargeActive });
});

/* =====================================================
   PRICE QUOTE  →  POST /api/quote   (public, read-only)
   Server-computed breakdown for display before payment. The frontend never
   computes amounts — it renders these figures. Reflects the live holiday flag.
   Body: { items:[{product_id, qty}] }
===================================================== */
app.post("/api/quote", quoteLimiter, async (req, res) => {
  try {
    const uid = await odooAuthenticate();
    const { breakdown, pricedItems } = await priceOrderFromOdoo(uid, req.body.items, {
      applyHoliday: holidaySurchargeActive,
    });
    res.json({
      ...breakdown,
      holiday_active: holidaySurchargeActive,
      items: pricedItems.map((i) => ({
        product_id: i.product_id, name: i.name, qty: i.qty, line_total: i.lineIncl,
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* =====================================================
   CREATE CHECKOUT SESSION  →  POST /create-checkout-session
   Payment-first flow: we do NOT create the Odoo order here. We re-price the
   cart from Odoo (server-side price integrity), create a Stripe Checkout
   session for that amount, and stash the cart in the session metadata. The
   Odoo pos.order is created only after Stripe confirms payment (see /webhook).

   Body:   { customer:{name,phone}, items:[{product_id, qty}], pickup_time }
   Return: { success, checkout_url, session_id, breakdown }

   Public (no API key): customers must be able to call it, and it can't be
   abused for pricing — amounts are re-read from Odoo server-side, never from
   the client. API_KEY stays private for POS-only endpoints (holiday toggle).
===================================================== */
app.post("/create-checkout-session", checkoutLimiter, async (req, res) => {
  try {
    const { customer, items, pickup_time } = req.body;

    console.log("🟡 Checkout request:", JSON.stringify({ customer, items }, null, 2));

    if (!stripe)          throw new Error("Stripe not configured (check STRIPE_SECRET_KEY)");
    if (!customer?.name || !customer?.phone) throw new Error("Customer name and phone are required");

    const uid = await odooAuthenticate();

    /* ---- Reject BEFORE charging if no POS session is open. The order can only
           be recorded into an open session, so we refuse up front rather than
           taking a payment we can't fulfil.
           TODO: support order-queuing so customers can order while the POS is
           closed (hold the payment intent / create the order when a session
           next opens). ---- */
    const openSessions = await odooCall(uid, "pos.session", "search_read",
      [[["state", "=", "opened"]]], { fields: ["id"], limit: 1 });
    if (!openSessions.length) {
      return res.status(409).json({
        success: false,
        error: "Online ordering is currently closed. Please try again during opening hours.",
      });
    }

    /* ---- Re-price from Odoo (ignore any client-sent prices). The live
           holiday flag decides whether the surcharge tax is applied. ---- */
    const { amountTotal, amountTax, pricedItems, breakdown } =
      await priceOrderFromOdoo(uid, items, { applyHoliday: holidaySurchargeActive });
    console.log(
      `💲 Server-priced order: $${amountTotal} (tax $${amountTax}` +
      `${breakdown.holiday_applied ? `, incl surcharge $${breakdown.holiday_surcharge}` : ""}) ` +
      `across ${pricedItems.length} line(s)`
    );

    /* ---- Compact cart for the webhook (Stripe metadata: keep it small) ---- */
    const metaItems = JSON.stringify(pricedItems.map((i) => [i.product_id, i.qty]));
    if (metaItems.length > 480) {
      throw new Error("Cart too large to process — please reduce the number of items");
    }

    /* ---- Stripe line items: each item at its pre-surcharge tax-incl price,
           plus one explicit surcharge line so the customer sees it broken out.
           The sum equals the Odoo total either way. ---- */
    const lineItems = pricedItems.map((i) => ({
      price_data: {
        currency: "aud",
        product_data: { name: i.qty > 1 ? `${i.name} × ${i.qty}` : i.name },
        unit_amount: Math.round((i.lineIncl - i.lineHoliday) * 100),
      },
      quantity: 1,
    }));
    if (breakdown.holiday_surcharge > 0) {
      lineItems.push({
        price_data: {
          currency: "aud",
          product_data: { name: "Public Holiday Surcharge (10%)" },
          unit_amount: Math.round(breakdown.holiday_surcharge * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${FRONTEND_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${FRONTEND_URL}/checkout`,
      metadata: {
        items:          metaItems,
        customer_name:  customer.name,
        customer_phone: customer.phone,
        ...(pickup_time && { pickup_time }),
      },
    });

    console.log("💳 Stripe session created:", session.id, "| total $" + amountTotal);
    // Mark this session as awaiting payment so the success page can poll.
    orderStatusBySession.set(session.id, { status: "pending" });

    res.json({ success: true, checkout_url: session.url, session_id: session.id, breakdown });

  } catch (err) {
    console.error("❌ CHECKOUT ERROR:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

/* =====================================================
   STRIPE WEBHOOK  →  POST /webhook   (raw body, signature-verified)
   The ONLY path that creates a paid order in Odoo. On
   checkout.session.completed (paid) we re-price from Odoo, create the
   pos.order, record the payment against "Stripe Online", and mark it paid.
   (Registered with express.raw near the top, before the JSON parser.)
===================================================== */
async function handleStripeWebhook(req, res) {
  if (!stripe)                return res.status(503).send("Stripe not configured");
  if (!STRIPE_WEBHOOK_SECRET) return res.status(503).send("Webhook secret not configured");

  let event;
  try {
    const sig = req.get("stripe-signature");
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    console.log("ℹ️  checkout.session.completed but not paid:", session.payment_status);
    return res.status(200).json({ received: true });
  }

  // Idempotency — Stripe retries; never create the order twice.
  if (processedSessions.has(session.id)) {
    console.log("ℹ️  Session already processed:", session.id);
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    const outcome = await createPaidOrder(session);
    processedSessions.add(session.id);
    orderStatusBySession.set(session.id, { status: "paid", ...outcome });
    console.log("🟢 Order created from paid session", session.id, "→", outcome.pos_reference);
    return res.status(200).json({ received: true, ...outcome });
  } catch (err) {
    if (err.terminal) {
      // A business condition that will NOT resolve on retry (e.g. the amount
      // Stripe charged no longer matches what Odoo prices this cart at). Do
      // NOT fabricate an order — record it for manual handling, mark the
      // session processed so Stripe stops retrying, and return 200.
      console.error("🛑 MANUAL HANDLING REQUIRED for", session.id, ":", err.message);
      processedSessions.add(session.id);
      orderStatusBySession.set(session.id, { status: err.status || "needs_manual_handling", error: err.message });
      return res.status(200).json({ received: true, error: err.message });
    }
    // Transient failure (Odoo unreachable, etc.) — record and return 500 so
    // Stripe retries. Idempotency guards against duplicates on retry.
    console.error("❌ ORDER CREATION FAILED after payment for", session.id, ":", err.message);
    orderStatusBySession.set(session.id, {
      status: "payment_received_order_failed",
      error: err.message,
    });
    return res.status(500).json({ received: true, error: err.message });
  }
}

/* Create + pay a pos.order in Odoo from a paid Stripe session. */
async function createPaidOrder(session) {
  const meta = session.metadata || {};
  let items;
  try {
    items = JSON.parse(meta.items || "[]").map(([product_id, qty]) => ({ product_id, qty }));
  } catch {
    throw new Error("Invalid cart metadata on session");
  }
  if (!items.length) throw new Error("No items in session metadata");

  const uid = await odooAuthenticate();

  // Re-price from Odoo — authoritative at capture time (matches counter orders).
  // Uses the LIVE holiday flag: if it was toggled between checkout and payment,
  // the total won't match what Stripe charged and the reconciliation guard
  // below flags the order for manual handling instead of creating a wrong one.
  const { orderLines, amountTotal, amountTax } =
    await priceOrderFromOdoo(uid, items, { applyHoliday: holidaySurchargeActive });

  /* ---- Reconcile Stripe amount vs Odoo price ----
     Stripe already charged the customer at checkout-time prices. If Odoo's
     prices/taxes changed before the webhook fired, the recomputed total won't
     match what was charged. We do NOT try to reverse-engineer a tax set to
     force the numbers to agree (that would fabricate accounting data). Instead
     we refuse to auto-create and flag for manual handling. Half-a-cent
     tolerance absorbs rounding. */
  const stripeTotal =
    typeof session.amount_total === "number" ? Math.round(session.amount_total) / 100 : null;
  if (stripeTotal != null && Math.abs(stripeTotal - amountTotal) > 0.005) {
    const err = new Error(
      `Amount mismatch: Stripe charged $${stripeTotal} but Odoo now prices this cart at ` +
      `$${amountTotal}. Order NOT auto-created — reconcile manually (customer WAS charged).`
    );
    err.terminal = true;
    err.status = "amount_mismatch";
    throw err;
  }

  const partnerId = await findOrCreatePartner(uid, meta.customer_name, meta.customer_phone);

  const sessions = await odooCall(uid, "pos.session", "search_read",
    [[["state", "=", "opened"]]],
    { fields: ["id", "name", "config_id"], limit: 1 }
  );
  if (!sessions.length) throw new Error("No open POS session — cannot record paid order");
  const posSession = sessions[0];

  /* ---- Create the order via the NATIVE POS pipeline (sync_from_ui) ----
     This is the same path the self-order app uses, so the order is a proper
     POS order (source="mobile") that the open POS recognises as an incoming
     online order — which is what drives the new-order handling / kitchen ticket
     (via the custom POS module) rather than a raw record the POS ignores. */
  const nowUtc = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines = orderLines.map(([, , l]) => [0, 0, { ...l, uuid: randomUUID() }]);

  const payload = {
    uuid:          randomUUID(),
    session_id:    posSession.id,
    partner_id:    partnerId || false,
    preset_id:     PRESET_ID,
    source:        "mobile",          // marks it an incoming Self-Order
    to_invoice:    false,
    ...(meta.pickup_time && { preset_time: meta.pickup_time }),
    state:         "paid",
    amount_tax:    amountTax,
    amount_total:  amountTotal,
    amount_paid:   amountTotal,
    amount_return: 0,
    lines,
    payment_ids: [[0, 0, {
      payment_method_id: stripeOnlinePmId,
      amount:            amountTotal,
      payment_date:      nowUtc,
    }]],
  };

  const result = await odooCall(uid, "pos.order", "sync_from_ui", [[payload]]);
  const rec = result?.["pos.order"]?.[0];
  if (!rec?.id) throw new Error("sync_from_ui did not return a created order");
  const order_id = rec.id;
  const pos_reference = rec.pos_reference || `#${order_id}`;

  console.log(`✅ POS order ${order_id} (${pos_reference}) paid $${amountTotal} via Stripe Online (native sync)`);

  return { order_id, pos_reference, amount_total: rec.amount_total ?? amountTotal };
}

/* =====================================================
   ORDER STATUS  →  GET /api/order-status?session_id=...
   Read-only. The success page polls this after Stripe redirects back.
===================================================== */
app.get("/api/order-status", (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ error: "session_id required" });
  const status = orderStatusBySession.get(sessionId);
  // Unknown id → treat as pending: the webhook may simply not have arrived yet.
  if (!status) return res.status(200).json({ status: "pending" });
  res.json(status);
});

/* =====================================================
   /confirm-order — REMOVED (Phase 2)
   Orders are confirmed only via the signature-verified Stripe webhook.
   This stub returns 410 Gone so any stale client fails clearly.
===================================================== */
app.all("/confirm-order", (req, res) => {
  res.status(410).json({
    error: "Gone: /confirm-order was removed. Orders are confirmed via the Stripe webhook.",
  });
});

/* =====================================================
   ERROR HANDLER
   CORS rejections surface as a thrown error → clean 403 (no 500/stack leak).
   Any other unhandled error → 500 with a generic message.
===================================================== */
app.use((err, req, res, next) => {
  if (err && /not allowed by cors/i.test(err.message || "")) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  console.error("❌ Unhandled error:", err?.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal server error" });
});

/* =====================================================
   START SERVER
   Resolve the "Stripe Online" payment method first — fail loudly if missing.
===================================================== */
async function start() {
  validateEnv();

  try {
    stripeOnlinePmId = await resolveStripeOnlinePmId();
  } catch (err) {
    console.error("❌ FATAL — cannot resolve Stripe Online payment method:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
    console.log(`   Odoo        : ${ODOO_URL}  (db: ${ODOO_DB})`);
    console.log(`   Frontend URL: ${FRONTEND_URL}`);
    console.log(`   Timezone    : ${TIMEZONE}`);
    console.log(`   Stripe      : ${stripe ? "configured" : "NOT CONFIGURED"}`);
    console.log(`   Stripe Online payment method id: ${stripeOnlinePmId}`);
    console.log(`   Webhook route: POST /webhook  (registered, signature-verified)`);
  });
}
start();