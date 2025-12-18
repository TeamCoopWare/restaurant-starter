import React from "react";
import { useCart } from "../lib/cartContext";
import Link from "next/link";


export default function CartDrawer() {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQty,
    clearCart,
  } = useCart();

  const total = items.reduce(
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
          <p className="cart-empty">Your cart is empty</p>
        ) : (
          <>
            <div className="cart-items">
              {items.map((i) => (
                <div key={i.id} className="cart-item">
                  <div>
                    <strong>{i.title}</strong>
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
                Total: ${total.toFixed(2)}
              </div>

              <Link href="/cart" onClick={closeCart}>
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
