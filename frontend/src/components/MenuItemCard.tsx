// frontend/src/components/MenuItemCard.tsx
import React from "react";
import { MenuItem } from "../pages/menu";
import { useCart } from "../lib/cartContext";

type Props = {
  item: MenuItem;
};

export default function MenuItemCard({ item }: Props) {
  const { addItem } = useCart();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 12px",
        borderRadius: 8,
        background: "transparent",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{item.title}</h3>
          <div style={{ color: "#a35325", fontWeight: 700 }}>${(item.price ?? 0).toFixed(2)}</div>
        </div>

        {item.description && <p style={{ margin: "8px 0 0", color: "#444", lineHeight: 1.5 }}>{item.description}</p>}
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          onClick={() => addItem({ id: item.id, title: item.title, price: item.price ?? 0, qty: 1 })}
          aria-label={`Add ${item.title} to cart`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 999,
            border: "none",
            background: "#f6b63a",
            color: "#2b1a12",
            cursor: "pointer",
            fontWeight: 800,
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          }}
        >
          {/* small cart icon svg */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#2b1a12" aria-hidden focusable="false">
            <path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7.2 14l.8-3h9.8a1 1 0 0 0 .95-.68l1.7-5.32A1 1 0 0 0 19.5 3H5.2L4.27.87A1 1 0 0 0 3.36 0H1v2h1l3.6 9.59L6.3 14H7.2z" />
          </svg>

          <span>Add</span>
        </button>
      </div>
    </div>
  );
}
