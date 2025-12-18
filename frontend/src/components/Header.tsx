import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "../lib/cartContext";
import { VIEW_ONLY_MENU } from "../../config/appConfig";


type HeaderProps = {
  shrinkOnScroll?: boolean;
};

export default function Header({ shrinkOnScroll = false }: HeaderProps) {
  const { items, openCart } = useCart();
  const headerRef = useRef<HTMLDivElement>(null);

  const [isShrunk, setIsShrunk] = useState(false);
  const [animate, setAnimate] = useState(false);

  /* -------------------------------
     TOTAL QUANTITY
  -------------------------------- */
  const totalQty = items.reduce(
    (sum, i) => sum + (i.qty ?? 0),
    0
  );

  /* -------------------------------
     HEADER OFFSET (CRITICAL FIX)
     Prevents menu titles being hidden
  -------------------------------- */
  useEffect(() => {
    const updateOffset = () => {
      if (headerRef.current) {
        const h = headerRef.current.offsetHeight;
        document.documentElement.style.setProperty(
          "--header-offset",
          `${h}px`
        );
      }
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => window.removeEventListener("resize", updateOffset);
  }, []);

  /* -------------------------------
     SHRINK ON SCROLL (MENU ONLY)
  -------------------------------- */
  useEffect(() => {
    if (!shrinkOnScroll) return;

    const onScroll = () => {
      setIsShrunk(window.scrollY > 60);
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [shrinkOnScroll]);

  /* -------------------------------
     BADGE ANIMATION
  -------------------------------- */
  useEffect(() => {
    if (totalQty > 0) {
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 300);
      return () => clearTimeout(t);
    }
  }, [totalQty]);

  return (
    <header
      ref={headerRef}
      className={`site-header menu-fixed-header ${
        isShrunk ? "header-shrink" : ""
      }`}
    >
      <div className="site-header-inner">
        {/* LOGO */}
        <div className="site-logo">
          <Link href="/">
            <img
              src="/images/logo-hero.png"
              alt="Sedap Eatery"
              className="site-logo-img"
            />
          </Link>
        </div>

        {/* CART BUTTON (OPENS DRAWER) */}
        {!VIEW_ONLY_MENU && (<button
          type="button"
          className="header-cart-btn"
          onClick={openCart}
        >
          <span aria-hidden>🛒</span>
          <span>Cart</span>

          {totalQty > 0 && (
            <span
              className={`header-cart-badge ${
                animate ? "badge-pop" : ""
              }`}
            >
              {totalQty}
            </span>
          )}
        </button>)}
      </div>
    </header>
  );
}
