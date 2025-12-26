import { useState } from "react";
import {
  CardElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

type Props = {
  amount: number;
  customer: {
    name: string;
    phone: string;
    address: {
      line1: string;
      city: string;
      postal_code: string;
      country: string;
    };
  };
  disabled: boolean;
};

export default function StripeCardForm({
  amount,
  customer,
  disabled,
}: Props) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;

    if (!cardComplete) {
      setMessage("Please complete card details");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      /* 1️⃣ Create Payment Intent */
      const res = await fetch(
        "http://localhost:4000/stripe/create-payment-intent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        }
      );

      const { clientSecret } = await res.json();

      /* 2️⃣ Confirm Card Payment */
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: customer.name,
            phone: customer.phone,
            address: {
              line1: customer.address.line1,
              city: customer.address.city,
              postal_code: customer.address.postal_code,
              country: customer.address.country,
            },
          },
        },
      });

      if (result.error) {
        setMessage(result.error.message || "Payment failed");
      } else if (result.paymentIntent?.status === "succeeded") {
        setMessage("✅ Payment successful! Order placed.");
      }
    } catch (err: any) {
      setMessage(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* CARD INPUT */}
      <div
        style={{
          background: "#fff",
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <CardElement
          options={{
            hidePostalCode: true, // 🔑 IMPORTANT
            style: {
              base: {
                fontSize: "16px",
                color: "#000",
                "::placeholder": { color: "#888" },
              },
              invalid: {
                color: "#c23d4b",
              },
            },
          }}
          onChange={(event) => {
            setCardComplete(event.complete);
            if (event.error) {
              setMessage(event.error.message);
            } else {
              setMessage(null);
            }
          }}
        />
      </div>

      {/* ERROR / SUCCESS MESSAGE */}
      {message && (
        <p style={{ color: message.includes("successful") ? "#2F7D32" : "#FFD700" }}>
          {message}
        </p>
      )}

      {/* PAY BUTTON */}
      <button
        onClick={handlePay}
        disabled={disabled || loading || !stripe || !cardComplete}
        style={{
          width: "100%",
          padding: 14,
          background:
            disabled || !cardComplete ? "#555" : "#2F7D32",
          border: "none",
          borderRadius: 10,
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          cursor:
            disabled || !cardComplete ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Processing Payment..." : "Pay Now"}
      </button>
    </>
  );
}
