import express from "express";
import cors from "cors";

import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const {
  ODOO_URL,
  ODOO_DB,
  ODOO_USERNAME,
  ODOO_API_KEY,
  PORT = 4000
} = process.env;

/* ---------- HEALTH ---------- */
app.get("/health", (req, res) => {
  res.json({ status: "ok", backend: "running" });
});

/* ---------- ODOO TEST ---------- */
app.get("/odoo/test", async (req, res) => {
  try {
    const payload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "authenticate",
        args: [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]
      },
      id: 1
    };

    const response = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.result) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed"
      });
    }

    res.json({
      success: true,
      message: "Connected to Odoo",
      uid: data.result
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

app.get("/odoo/products", async (req, res) => {
  try {
    console.log("🔐 Authenticating with Odoo...");

    /* 1️⃣ Authenticate */
    const authResponse = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "common",
          method: "authenticate",
          args: [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}],
        },
        id: 1,
      }),
    });

    const authData = await authResponse.json();
    const uid = authData.result;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }

    console.log("✅ Authenticated UID:", uid);

    /* 2️⃣ Fetch products */
    console.log("📦 Fetching products from Odoo...");

    const productResponse = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DB,
            uid,
            ODOO_API_KEY,
            "product.product",
            "search_read",
            [[]],
            {
              fields: ["id", "name", "list_price"],
              limit: 20,
            },
          ],
        },
        id: 2,
      }),
    });

    const productData = await productResponse.json();

    console.log("🧾 Odoo product response:", JSON.stringify(productData, null, 2));

    res.json({
      success: true,
      products: productData.result,
    });

  } catch (err) {
    console.error("❌ Error fetching products:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
/* ---------- SINGLE PRODUCT ---------- */
app.get("/odoo/product/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);

    const authPayload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "authenticate",
        args: [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}]
      },
      id: 1
    };

    const authRes = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authPayload)
    });

    const authData = await authRes.json();
    const uid = authData.result;

    if (!uid) {
      return res.status(401).json({ success: false, error: "Auth failed" });
    }

    const productPayload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          ODOO_DB,
          uid,
          ODOO_API_KEY,
          "product.product",
          "read",
          [[productId]],
          { fields: ["id", "name", "list_price"] }
        ]
      },
      id: 2
    };

    const productRes = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productPayload)
    });

    const productData = await productRes.json();

    res.json({ success: true, product: productData.result[0] });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
/* ---------- CREATE ORDER ---------- */
app.post("/odoo/order", async (req, res) => {
  try {
    const { customer, items } = req.body;

    // 1️⃣ Authenticate
    const authPayload = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "authenticate",
        args: [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}],
      },
      id: 1,
    };

    const authRes = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authPayload),
    });

    const authData = await authRes.json();
    const uid = authData.result;

    if (!uid) {
      return res.status(401).json({ success: false, error: "Auth failed" });
    }

    // 2️⃣ Create customer (partner)
    const partnerRes = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DB,
            uid,
            ODOO_API_KEY,
            "res.partner",
            "create",
            [{
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
            }],
          ],
        },
        id: 2,
      }),
    });

    const partnerData = await partnerRes.json();
    const partnerId = partnerData.result;

    // 3️⃣ Create Sale Order
    const orderRes = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DB,
            uid,
            ODOO_API_KEY,
            "sale.order",
            "create",
            [{
              partner_id: partnerId,
              order_line: items.map((item) => {
  if (!item.odooProductId) {
    throw new Error("Missing odooProductId for item: " + item.title);
  }

  return [
    0,
    0,
    {
      product_id: Number(item.odooProductId),
      product_uom_qty: item.qty,
      price_unit: item.price,
      name: item.title,
    },
  ];
}),

            }],
          ],
        },
        id: 3,
      }),
    });

    const orderData = await orderRes.json();

    res.json({
      success: true,
      orderId: orderData.result,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
