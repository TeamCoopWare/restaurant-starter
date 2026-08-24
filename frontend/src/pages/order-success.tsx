import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Header from "../components/Header";
import { useCart } from "../lib/cartContext";
import { API_URL } from "../lib/api";

export default function OrderSuccessPage() {
  const router = useRouter();
  const { clearCart } = useCart();
  const startedRef = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const [posReference, setPosReference] = useState<string | null>(null);

  // Stripe redirects back with ?session_id=... — we poll the backend
  // (read-only) for the order the webhook creates. This page never marks
  // anything paid; payment confirmation happens server-side via the webhook.
  const sessionId = router.query.session_id as string | undefined;

  useEffect(() => {
    if (!sessionId || startedRef.current) return;
    startedRef.current = true;

    clearCart();

    let tries = 0;
    const poll = () => {
      fetch(`${API_URL}/api/order-status?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "paid") {
            if (data.pos_reference) setPosReference(data.pos_reference);
            setConfirmed(true);
            return;
          }
          // Webhook may not have landed yet — keep polling briefly.
          if (tries++ < 15) setTimeout(poll, 1000);
          else setConfirmed(true); // stop spinning; order will still process
        })
        .catch(() => {
          if (tries++ < 15) setTimeout(poll, 1000);
          else setConfirmed(true);
        });
    };
    poll();
  }, [sessionId]);

  const displayRef = posReference;

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
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>

          <h1 style={{ marginBottom: 12 }}>Order Confirmed!</h1>

          <p style={{ marginBottom: 10, fontSize: 16 }}>
            Thank you for your order at Sedap Eatery!
          </p>

          {displayRef && (
            <p style={{ marginBottom: 20, opacity: 0.9 }}>
              <strong>Order Number:</strong> {displayRef}
            </p>
          )}

          <p style={{ marginBottom: 24, fontSize: 14, opacity: 0.85, lineHeight: 1.6 }}>
            Your payment was successful. Our kitchen has received your order
            and is preparing it now. We&apos;ll have it ready shortly!
          </p>

          {!confirmed && sessionId && (
            <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
              Confirming order with our system...
            </p>
          )}

          <button
            onClick={() => router.push("/menu")}
            style={{
              padding: "14px 20px",
              background: "#2F7D32",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Back to Menu
          </button>

          <button
            onClick={() => router.push("/")}
            style={{
              marginTop: 10,
              padding: "12px 20px",
              background: "transparent",
              border: "2px solid rgba(255,255,255,0.3)",
              borderRadius: 10,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Back to Home
          </button>
        </div>
      </main>
    </>
  );
}