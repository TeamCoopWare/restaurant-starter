import React, { useEffect, useState } from "react";
import { useCart } from "../lib/cartContext";
import { API_URL } from "../lib/api";
import Link from "next/link";

export default function CartDrawer() {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQty,
    clearCart,
  } = useCart();

  const [holidayActive, setHolidayActive] = useState(false);

  // Surface (display-only) whether the public-holiday surcharge is on, so the
  // customer sees it will be added before they reach checkout.
  useEffect(() => {
    if (!isCartOpen) return;
    fetch(`${API_URL}/api/holiday/status`)
      .then((r) => r.json())
      .then((d) => setHolidayActive(!!d.active))
      .catch(() => {});
  }, [isCartOpen]);

  const subtotal = items.reduce(
    (sum, i) => sum + i.price * i.qty,
    0
  );

  if (!isCartOpen) return null;

  return (
    <>
      {/* BACKDROP */}
      <div className="cart-backdrop" onClick={closeCart} />

      {/* DRAWER */}
      <aside className="cart-drawer">
        <header className="cart-header">
          <h3>Your Cart</h3>
          <button onClick={closeCart}>✕</button>
        </header>

        {items.length === 0 ? (
          <p className="cart-empty"> Your cart is empty</p>
        ) : (
          <>
            <div className="cart-items">
              {items.map((i) => (
                <div key={i.id} className="cart-item">
                  <div>
                    {/* ✅ SHOW VARIANT-AWARE NAME */}
                    <strong>{i.name ?? i.title}</strong>

                    <div className="cart-price">
                      ${(i.price * i.qty).toFixed(2)}
                    </div>
                  </div>

                  <div className="cart-qty">
                    <button onClick={() => updateQty(i.id, i.qty - 1)}>
                      −
                    </button>
                    <span>{i.qty}</span>
                    <button onClick={() => updateQty(i.id, i.qty + 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <footer className="cart-footer">
              <div className="cart-total">
                Subtotal: ${subtotal.toFixed(2)}
              </div>
              {holidayActive && (
                <div style={{ fontSize: 12, color: "#c0392b", marginTop: 4 }}>
                  +10% public holiday surcharge applied at checkout
                </div>
              )}

              <Link href="/checkout" onClick={closeCart}>
                <button className="checkout-btn">
                  Checkout
                </button>
              </Link>

              <button
                className="clear-btn"
                onClick={clearCart}
              >
                Clear Cart
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
