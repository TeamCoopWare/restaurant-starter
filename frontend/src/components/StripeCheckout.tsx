import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useState } from "react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function CheckoutForm({ amount }: { amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: "http://localhost:3000/checkout-success",
      },
    });

    if (error) {
      alert(error.message);
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button
        disabled={!stripe || loading}
        style={{
          marginTop: 16,
          width: "100%",
          padding: 12,
          background: "#2F7D32",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 16,
        }}
      >
        {loading ? "Processing..." : `Pay $${amount.toFixed(2)}`}
      </button>
    </form>
  );
}

export default function StripeCheckout({ amount }: { amount: number }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const createPaymentIntent = async () => {
    const res = await fetch("http://localhost:4000/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });

    const data = await res.json();
    setClientSecret(data.clientSecret);
  };

  if (!clientSecret) {
    return (
      <button
        onClick={createPaymentIntent}
        style={{
          width: "100%",
          padding: 14,
          background: "#2F7D32",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        Proceed to Payment
      </button>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm amount={amount} />
    </Elements>
  );
}
