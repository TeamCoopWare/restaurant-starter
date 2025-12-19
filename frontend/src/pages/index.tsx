import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div style={{ width: "100%", margin: 0, padding: 0 }}>
      <section className="hero-batik-logo">
        <div className="site-container hero-content">
          <div className="hero-left">
            <h1 className="hero-title">
              <span className="prefix">Welcome to</span>
              <br />
              <span className="highlight">Sedap Eatery</span>
            </h1>

            <p className="hero-subtitle">
              Authentic Malaysian cuisine — handcrafted daily using traditional recipes and fragrant spices.
            </p>

            <div className="hero-buttons">
              <Link href="/menu" className="btn btn-primary">View Menu →</Link>
              
              
<div className="hero-icon-group">
  {/* CALL ICON */}
  <a
    href="tel:+61460316046"
    className="hero-icon call"
    aria-label="Call Sedap Eatery"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="white"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.09 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.12.97.37 1.92.73 2.82a2 2 0 0 1-.45 2.11L8.91 10.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.36 1.85.61 2.82.73A2 2 0 0 1 22 16.92z" />
    </svg>
  </a>

  {/* SOCIAL ICONS */}
  <a
    href="https://www.instagram.com/sedapeatery_adelaide"
    target="_blank"
    rel="noreferrer"
    className="hero-icon"
    aria-label="Instagram"
  >
    <img src="/images/insta.jpg" alt="Instagram" />
  </a>

  <a
    href="https://www.facebook.com/share/164c1Jw9Nu/"
    target="_blank"
    rel="noreferrer"
    className="hero-icon"
    aria-label="Facebook"
  >
    <img src="/images/fb.jpg" alt="Facebook" />
  </a>
</div>

            
     </div>    
         
</div>


          <div className="hero-right" aria-hidden>
            <img src="/images/logo-hero.png" alt="Sedap Eatery Logo" className="hero-logo" />
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-grid site-container">
          <div className="feature-card">
            <div className="feature-icon">🍽️</div>
            <div>
              <h3 className="feature-title">Authentic Recipes</h3>
              <p className="feature-desc">Traditional Malaysian dishes made from family recipes and fresh ingredients.</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⏱️</div>
            <div>
              <h3 className="feature-title">Fast Pickup</h3>
              <p className="feature-desc">Ready quickly for pickup — hot and fresh.</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🌶️</div>
            <div>
              <h3 className="feature-title">Bold Flavours</h3>
              <p className="feature-desc">Spices and aromas true to Malaysian cooking.</p>
            </div>
          </div>
        </div>
      </section>
<a
  href="https://wa.me/61460316046"
  target="_blank"
  rel="noreferrer"
  className="whatsapp-float"
  aria-label="Message on WhatsApp"
>
  <img
    src="/images/whatsapp-icon.png"
    alt="WhatsApp"
    className="whatsapp-icon"
  />
</a>

      <footer className="footer">
        <div className="footer-inner site-container">
          <div className="footer-brand">Sedap Eatery</div>Shop #4, 10–26 Vale Ave, Valley View, SA
          <div className="footer-info">
  Powered by{" "}
  <a
    href="https://dispatch.genzonix.com/"
    target="_blank"
    rel="noreferrer"
    className="footer-link"
  >
    TeamCoopTech
  </a>
</div>

        </div>
      </footer>
    </div>
  );
}
