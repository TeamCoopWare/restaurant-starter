/* =====================================================
   test:order — end-to-end order test in Stripe TEST mode.
   Run (backend must be running):  npm run test:order

   Exercises the full server pipeline exactly as production does:
     create-checkout-session → real Stripe session → signature-verified
     webhook → Odoo pos.order + Stripe Online payment + tax lines →
     amount reconciliation → order-status.

   The webhook event is signed with the real session's amount (fetched from
   Stripe) using Stripe's official test-header helper, so signature
   verification and the reconciliation guard are genuinely tested. The one
   thing it does not do is type a card on Stripe's hosted page (not automatable
   from a script) — that path is covered by the manual 4242 test runs.

   Config via env: TEST_PRODUCT_ID (default 88), TEST_QTY (default 1).
===================================================== */
import "dotenv/config";
import Stripe from "stripe";

const {
  PORT = 4000,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  ODOO_URL = "http://localhost:8069",
  ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD,
  TEST_PRODUCT_ID = "88",
  TEST_QTY = "1",
} = process.env;

const API = `http://localhost:${PORT}`;
const stripe = new Stripe(STRIPE_SECRET_KEY);

const die = (msg) => { console.error("❌ test:order FAILED —", msg); process.exit(1); };

async function odoo(model, method, args, kwargs = {}) {
  const auth = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {
      service: "common", method: "authenticate", args: [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}] } }),
  }).then((r) => r.json());
  const uid = auth.result;
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 2, params: {
      service: "object", method: "execute_kw", args: [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargs] } }),
  }).then((r) => r.json());
  if (res.error) throw new Error(res.error.data?.message || "Odoo error");
  return res.result;
}

(async () => {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) die("STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set");

  // 0. Backend up?
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
  if (!health) die(`backend not reachable at ${API} — start it first (npm start)`);

  const items = [{ product_id: Number(TEST_PRODUCT_ID), qty: Number(TEST_QTY) }];

  // 1. Create the checkout session through the backend (real Odoo pricing).
  const created = await fetch(`${API}/create-checkout-session`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer: { name: "Automated Test", phone: "0400000001" }, pickup_time: null, items }),
  }).then((r) => r.json());
  if (!created.success) die(`create-checkout-session: ${created.error}`);
  console.log(`🧾 Session ${created.session_id} | total $${created.breakdown.total} (gst $${created.breakdown.gst}, surcharge $${created.breakdown.holiday_surcharge})`);

  // 2. Fetch the real session from Stripe (authoritative amount + metadata).
  const session = await stripe.checkout.sessions.retrieve(created.session_id);
  const amountDollars = (session.amount_total / 100).toFixed(2);
  console.log(`💳 Stripe session amount: $${amountDollars} ${session.currency.toUpperCase()}`);

  // 3. Simulate Stripe's checkout.session.completed with a VALID signature
  //    (Stripe's own test-header helper) and the real amount + metadata.
  const event = {
    id: "evt_test_order", object: "event", type: "checkout.session.completed",
    data: { object: { ...session, payment_status: "paid" } },
  };
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: STRIPE_WEBHOOK_SECRET });
  const whRes = await fetch(`${API}/webhook`, {
    method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": header }, body: payload,
  });
  const whBody = await whRes.json();
  if (whRes.status !== 200) die(`webhook returned ${whRes.status}: ${JSON.stringify(whBody)}`);
  if (whBody.error) die(`webhook rejected order: ${whBody.error}`);

  // 4. Poll order-status.
  let status = null;
  for (let i = 0; i < 10; i++) {
    status = await fetch(`${API}/api/order-status?session_id=${created.session_id}`).then((r) => r.json());
    if (status.status === "paid") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (status?.status !== "paid") die(`order not paid — status: ${JSON.stringify(status)}`);
  console.log(`✅ Order ${status.order_id} (${status.pos_reference}) recorded`);

  // 5. Verify in Odoo: paid, Stripe Online payment, tax lines, amount matches.
  const [order] = await odoo("pos.order", "read", [[status.order_id]],
    { fields: ["state", "amount_total", "amount_tax", "pos_reference"] });
  const pay = await odoo("pos.payment", "search_read", [[["pos_order_id", "=", status.order_id]]],
    { fields: ["amount", "payment_method_id"] });
  const lines = await odoo("pos.order.line", "search_read", [[["order_id", "=", status.order_id]]],
    { fields: ["product_id", "tax_ids", "price_subtotal", "price_subtotal_incl"] });

  const pmName = pay[0]?.payment_method_id?.[1];
  const problems = [];
  if (order.state !== "paid") problems.push(`state=${order.state}`);
  if (pmName !== "Stripe Online") problems.push(`payment method=${pmName}`);
  if (Math.abs(order.amount_total - session.amount_total / 100) > 0.005) problems.push(`amount ${order.amount_total} != charged ${session.amount_total / 100}`);
  if (!lines.length || lines.some((l) => !l.tax_ids?.length)) problems.push("a line has no tax_ids");
  if (problems.length) die(`Odoo verification: ${problems.join("; ")}`);

  console.log("\n✅ test:order PASSED");
  console.log(`   ${status.pos_reference} | $${order.amount_total} (tax $${order.amount_tax}) | ${pmName} | ${lines.length} line(s), all taxed`);
  process.exit(0);
})().catch((e) => die(e.message));
