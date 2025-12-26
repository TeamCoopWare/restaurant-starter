import { useRouter } from "next/router";
import Header from "../components/Header";

export default function OrderSuccessPage() {
  const router = useRouter();
  const { orderId } = router.query;

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
          <h1 style={{ marginBottom: 12 }}>🎉 Order Confirmed</h1>

          <p style={{ marginBottom: 10, fontSize: 16 }}>
            Thank you for your order!
          </p>

          {orderId && (
            <p style={{ marginBottom: 20, opacity: 0.9 }}>
              <strong>Order Number:</strong> #{orderId}
            </p>
          )}

          <p style={{ marginBottom: 24, fontSize: 14, opacity: 0.9 }}>
            Your payment was successful.  
            Our kitchen has received your order and is preparing it now.
          </p>

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
        </div>
      </main>
    </>
  );
}
