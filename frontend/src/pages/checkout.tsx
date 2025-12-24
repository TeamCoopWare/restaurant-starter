import React, { useState } from "react";
import { useRouter } from "next/router";
import { useCart } from "../lib/cartContext";
import Header from "../components/Header";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const total = items.reduce(
    (sum: number, item: any) => sum + item.price * item.qty,
    0
  );
const handlePlaceOrder = async () => {
  if (!name || !phone) {
    alert("Please enter name and phone number");
    return;
  }

  setLoading(true);

  try {
    const res = await fetch("http://localhost:4000/odoo/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: { name, phone, notes },
        items,
        total,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Order failed");
    }

    alert(`Order placed! Order #${data.orderId}`);
    clearCart();
    router.push("/menu");

  } catch (err: any) {
    alert(err.message || "Something went wrong");
  } finally {
    setLoading(false);
  }
};


  return (
    <>
      <Header />

      <main
        style={{
          background: "#7A3A28",
          minHeight: "100vh",
          padding: "110px 16px 40px",
          color: "#fff",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            background: "#7A3320",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h1 style={{ marginBottom: 16 }}>Checkout</h1>

          {/* ORDER SUMMARY */}
          <div style={{ marginBottom: 20 }}>
            {items.map((item: any) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  fontSize: 15,
                }}
              >
                <span>
                  {item.title} × {item.qty}
                </span>
                <span>${(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}

            <hr style={{ opacity: 0.3, margin: "12px 0" }} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* CUSTOMER DETAILS */}
          <div style={{ marginBottom: 14 }}>
            <label>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label>Phone *</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label>Order Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "none" }}
              placeholder="e.g. Less spicy, no peanuts"
            />
          </div>

          {/* ACTION */}
          <button
            onClick={handlePlaceOrder}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: "#2F7D32",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {loading ? "Placing Order..." : "Place Order"}
          </button>
        </div>
      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
};
console.log("ODOO URL:", process.env.ODOO_URL);
