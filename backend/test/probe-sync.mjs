/* Throwaway probe: create ONE paid order via pos.order.sync_from_ui (the native
   POS path) to learn the exact Odoo 19 return format and see whether it drives
   the POS popup + kitchen print. Product 88 (Potato Masala), qty 1.
   Run: node test/probe-sync.mjs */
import "dotenv/config";
import { randomUUID } from "crypto";

const { ODOO_URL = "http://localhost:8069", ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD,
        STRIPE_ONLINE_PM_ID } = process.env;
const PID = 88;

async function rpc(service, method, args) {
  const r = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { service, method, args } }),
  }).then((x) => x.json());
  if (r.error) throw new Error(JSON.stringify(r.error.data?.message || r.error));
  return r.result;
}
const uid = await rpc("common", "authenticate", [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}]);
const kw = (model, method, args, kwargs = {}) =>
  rpc("object", "execute_kw", [ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargs]);

const [sess] = await kw("pos.session", "search_read", [[["state", "=", "opened"]]], { fields: ["id", "config_id"], limit: 1 });
const [p] = await kw("product.product", "read", [[PID]], { fields: ["lst_price", "taxes_id"] });
const t = await kw("account.tax", "compute_all", [p.taxes_id, p.lst_price, false, 1, false, false]);
const excl = Math.round(t.total_excluded * 100) / 100;
const incl = Math.round(t.total_included * 100) / 100;
const pm = Number(STRIPE_ONLINE_PM_ID) || 7;
const now = new Date().toISOString().slice(0, 19).replace("T", " ");

const order = {
  uuid: randomUUID(),
  session_id: sess.id,
  partner_id: false,
  preset_id: 2,
  source: "mobile",          // mark as an incoming Self-Order (drives the POS popup)
  state: "paid",
  amount_tax: Math.round((incl - excl) * 100) / 100,
  amount_total: incl,
  amount_paid: incl,
  amount_return: 0,
  to_invoice: false,
  lines: [[0, 0, {
    uuid: randomUUID(), product_id: PID, qty: 1, price_unit: p.lst_price,
    price_subtotal: excl, price_subtotal_incl: incl, discount: 0,
    tax_ids: [[6, 0, p.taxes_id]],
  }]],
  payment_ids: [[0, 0, { payment_method_id: pm, amount: incl, payment_date: now }]],
};

console.log("→ calling sync_from_ui with:", JSON.stringify(order, null, 2));
try {
  const result = await kw("pos.order", "sync_from_ui", [[order]]);
  console.log("\n✅ sync_from_ui RESULT:\n", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("\n❌ sync_from_ui ERROR:\n", e.message);
}
