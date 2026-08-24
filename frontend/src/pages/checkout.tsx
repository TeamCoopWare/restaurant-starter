import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useCart } from "../lib/cartContext";
import { API_URL } from "../lib/api";
import { isClosedToday, CLOSED_DAYS_LABEL } from "../lib/hours";
import Header from "../components/Header";

interface TimeSlot {
  label: string;      // "7:40 PM"
  value: string;      // "2026-04-14 19:40:00" (UTC for Odoo)
  localTime: string;  // "19:40" (for display)
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items } = useCart();

  const [name,        setName]        = useState("");
  const [phone,       setPhone]       = useState("");
  const [pickupSlot,  setPickupSlot]  = useState<TimeSlot | null>(null);
  const [timeSlots,   setTimeSlots]   = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [loading,          setLoading]         = useState(false);
  const [holidayActive,    setHolidayActive]   = useState(false);
  // Closed Mon & Tue — computed client-side after mount (restaurant TZ).
  const [closedToday,      setClosedToday]     = useState(false);
  useEffect(() => { setClosedToday(isClosedToday()); }, []);

  // Server-computed price breakdown — the frontend never computes amounts.
  const [quote, setQuote] = useState<{
    subtotal: number; gst: number; holiday_surcharge: number; total: number;
  } | null>(null);

  // Plain client sum, shown only as a placeholder until the quote arrives.
  const displaySubtotal = items.reduce(
    (sum: number, item: any) => sum + item.price * item.qty, 0
  );

  const subtotalDisplay = quote ? quote.subtotal : displaySubtotal;
  const surchargeDisplay = quote ? quote.holiday_surcharge : 0;
  const total            = quote ? quote.total : displaySubtotal;

  /* ── Fetch the server price breakdown (reflects the live holiday flag) ── */
  useEffect(() => {
    const quoteItems = items
      .map((i: any) => ({ product_id: i.odooProductId, qty: i.qty }))
      .filter((i: any) => i.product_id);
    if (!quoteItems.length) { setQuote(null); return; }

    fetch(`${API_URL}/api/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: quoteItems }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.total === "number") {
          setQuote(data);
          setHolidayActive(!!data.holiday_active);
        }
      })
      .catch(() => {});
  }, [items]);

  /* ── Fetch pickup slots from the backend (computed in the restaurant's
        timezone — Australia/Adelaide). There is intentionally NO client-side
        fallback: it would generate slots in the visitor's local timezone and
        send the wrong pickup time to Odoo. If the backend is unreachable the
        customer can't order anyway, so we just show an unavailable message. ── */
  useEffect(() => {
    fetch(`${API_URL}/api/timeslots`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.slots) && data.slots.length > 0) {
          setTimeSlots(data.slots);
          setPickupSlot(data.slots[0]);
        }
      })
      .catch(() => {
        setTimeSlots([]);
      })
      .finally(() => setSlotsLoading(false));
  }, []);

  const isFormValid =
    !closedToday &&
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    pickupSlot !== null &&
    items.length > 0;

  const handleProceedToPayment = async () => {
    if (closedToday) return;
    if (!isFormValid || loading) return;
    setLoading(true);

    try {
      // Send only product_id + qty — the backend re-prices from Odoo.
      // No API key: this endpoint is public (prices are server-enforced).
      const res = await fetch(`${API_URL}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer:    { name, phone },
          pickup_time: pickupSlot!.value,   // Odoo UTC datetime string
          items: items
            .map((i: any) => ({ product_id: i.odooProductId, qty: i.qty }))
            .filter((i: any) => i.product_id),
        }),
      });

      const data = await res.json();
      console.log("Backend response:", data);

      if (!data.success || !data.checkout_url) {
        throw new Error(data.error || "Failed to create order");
      }

      window.location.href = data.checkout_url;

    } catch (err: any) {
      console.error("❌ Order error:", err);
      alert(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <main style={{ background: "#7A3A28", minHeight: "100vh", padding: "110px 16px 40px", color: "#fff" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", background: "#7A3320", borderRadius: 14, padding: 22 }}>
          <h1 style={{ marginBottom: 18 }}>Checkout</h1>

          {closedToday && (
            <div style={{
              background: "#c0392b", color: "#fff", borderRadius: 10,
              padding: "12px 16px", marginBottom: 18, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 10, fontSize: 14,
            }}>
              <span>🔒</span>
              <span>We're closed today — {CLOSED_DAYS_LABEL}. Orders can't be placed right now; please order again from Wednesday.</span>
            </div>
          )}

          {/* ORDER SUMMARY */}
          <section style={{ marginBottom: 22 }}>
            {items.map((item: any) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>{(item.name || item.title)} × {item.qty}</span>
                <span>${(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}
            <hr style={{ opacity: 0.3, margin: "14px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span>Subtotal</span>
              <span>${subtotalDisplay.toFixed(2)}</span>
            </div>
            {surchargeDisplay > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#FFD042" }}>
                <span>Public Holiday Surcharge (10%)</span>
                <span>+${surchargeDisplay.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 16 }}>
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </section>

          {/* PICKUP NOTICE */}
          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🏪</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Pickup Only</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>Shop #4, 10–26 Vale Ave, Valley View SA</div>
            </div>
          </div>

          {/* HOLIDAY SURCHARGE NOTICE — the surcharge amount itself is shown in
              the order summary above; this just explains it. */}
          {holidayActive && (
            <div style={{
              background: "rgba(240,165,0,0.15)", borderRadius: 10,
              padding: "12px 16px", marginBottom: 18,
              border: "2px solid #f0a500",
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#FFD042" }}>
                🎌 Public Holiday Surcharge
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                A 10% public holiday surcharge applies to today&apos;s orders.
              </div>
            </div>
          )}

          {/* CUSTOMER DETAILS */}
          <section style={{ marginBottom: 22 }}>
            <h3 style={sectionTitle}>Your Details</h3>
            <label>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="Your full name"
            />
            <label>Phone *</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
              placeholder="Your phone number"
            />
          </section>

          {/* PICKUP TIME — grid of buttons matching Odoo UI */}
          <section style={{ marginBottom: 22 }}>
            <h3 style={sectionTitle}>⏰ Pickup Time</h3>

            {slotsLoading ? (
              <div style={{ opacity: 0.7, fontSize: 14, padding: "8px 0" }}>
                Loading available times...
              </div>
            ) : timeSlots.length === 0 ? (
              <div style={{ opacity: 0.7, fontSize: 14 }}>
                No time slots available right now.
              </div>
            ) : (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                  marginBottom: 8,
                }}>
                  {timeSlots.map((slot) => {
                    const isSelected = pickupSlot?.value === slot.value;
                    return (
                      <button
                        key={slot.value}
                        type="button"
                        onClick={() => setPickupSlot(slot)}
                        style={{
                          padding: "10px 4px",
                          borderRadius: 8,
                          border: "2px solid",
                          borderColor:     isSelected ? "#FFD042" : "rgba(255,255,255,0.25)",
                          background:      isSelected ? "#FFD042" : "rgba(255,255,255,0.08)",
                          color:           isSelected ? "#3a1a0a" : "#fff",
                          fontWeight:      isSelected ? 700 : 500,
                          fontSize:        13,
                          cursor:          "pointer",
                          transition:      "all 0.15s",
                        }}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  Ready in approximately 15–20 minutes
                </div>
              </>
            )}
          </section>

          {!isFormValid && (
            <p style={{ color: "#FFD700", marginBottom: 14, fontSize: 13 }}>
              Please fill in your name, phone, and select a pickup time.
            </p>
          )}

          {/* ACTIONS */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => router.push("/menu")} style={returnBtn}>
              ← Return to Menu
            </button>
            <button
              onClick={handleProceedToPayment}
              disabled={!isFormValid || loading}
              style={{
                ...payBtn,
                opacity: isFormValid && !loading ? 1 : 0.6,
                cursor:  isFormValid && !loading ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Redirecting..." : "Proceed to Payment"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", marginTop: 6, marginBottom: 12,
  padding: "10px 12px", borderRadius: 8, border: "none", fontSize: 14,
};
const sectionTitle: React.CSSProperties = {
  marginBottom: 10, fontSize: 16, fontWeight: 600,
};
const returnBtn: React.CSSProperties = {
  flex: 1, padding: 14, background: "#FFD042", border: "none",
  borderRadius: 10, color: "#000", fontSize: 15, fontWeight: 600, cursor: "pointer",
};
const payBtn: React.CSSProperties = {
  flex: 1, padding: 14, background: "#2F7D32", border: "none",
  borderRadius: 10, color: "#fff", fontSize: 15, fontWeight: 600,
};