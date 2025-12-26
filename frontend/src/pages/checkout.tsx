import React, { useState } from "react";
import { useRouter } from "next/router";
import { useCart } from "../lib/cartContext";
import Header from "../components/Header";

import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "../lib/stripe";
import StripeCardForm from "../components/StripeCardForm";

export default function CheckoutPage() {
  const router = useRouter();
  const { items } = useCart();



  /* CUSTOMER */
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  /* ADDRESS */
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");

  const total = items.reduce(
    (sum: number, item: any) => sum + item.price * item.qty,
    0
  );

  /* STRICT FORM VALIDATION */
  const isFormValid =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    street.trim().length > 0 &&
    suburb.trim().length > 0 &&
    postcode.trim().length > 0;

  return (
    <Elements stripe={stripePromise}>
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
            maxWidth: 560,
            margin: "0 auto",
            background: "#7A3320",
            borderRadius: 14,
            padding: 22,
          }}
        >
          <h1 style={{ marginBottom: 18 }}>Checkout</h1>

          {/* ORDER SUMMARY */}
          <section style={{ marginBottom: 22 }}>
            {items.map((item: any) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span>
                  {item.title} × {item.qty}
                </span>
                <span>${(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}

            <hr style={{ opacity: 0.3, margin: "14px 0" }} />

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
          </section>

          {/* CUSTOMER DETAILS */}
          <section style={{ marginBottom: 18 }}>
            <h3 style={sectionTitle}>Customer Details</h3>

            <label>Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />

            <label>Phone *</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </section>

          {/* ADDRESS */}
          <section style={{ marginBottom: 18 }}>
            <h3 style={sectionTitle}>Delivery Address</h3>

            <label>Street *</label>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              style={inputStyle}
            />

            <label>Suburb *</label>
            <input
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              style={inputStyle}
            />

            <label>Postcode *</label>
            <input
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              style={inputStyle}
            />
          </section>

          {/* PAYMENT */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={sectionTitle}>Card Details *</h3>

            <div
              style={{
                opacity: isFormValid ? 1 : 0.5,
                pointerEvents: isFormValid ? "auto" : "none",
              }}
            >
              <StripeCardForm
                amount={total}
                customer={{
                  name,
                  phone,
                  address: {
                    line1: street,
                    city: suburb,
                    postal_code: postcode,
                    country: "AU",
                  },
                }}
                disabled={!isFormValid}
              />
            </div>

            {!isFormValid && (
              <p style={{ color: "#FFD700", marginTop: 8 }}>
                Please complete all required fields before payment.
              </p>
            )}
          </section>

          {/* NAVIGATION */}
          <div style={{ display: "flex", gap: 12, 
           }}>
            <button
              onClick={() => router.push("/menu")}
              style={secondaryBtn} 
             
            >
              ← Return to Menu
            </button>
          </div>
        </div>
      </main>
    </Elements>
  );
}

/* STYLES */
const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  marginBottom: 12,
  padding: "10px 12px",
  borderRadius: 8,
  border: "none",
  fontSize: 14,
};

const sectionTitle: React.CSSProperties = {
  marginBottom: 10,
  fontSize: 16,
  fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  padding: 14,
  background: "#555",
  border: "none",
  borderRadius: 10,
  color: "#fff",
  fontSize: 15,
  cursor: "pointer",
};
