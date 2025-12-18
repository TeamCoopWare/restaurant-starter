import React from "react";
import Link from "next/link";
import Header from "../components/Header";

export default function HomePage() {
  return (
    <div>
      <Header />

      <section className="hero-batik">
        <div className="hero-content">
          <div className="hero-left">
            <h1 className="hero-title"><span className="prefix">Welcome to</span> <br /> <span className="highlight">Sedap Eatery</span></h1>
            <div className="hero-subtitle">Authentic Malaysian cuisine — handcrafted daily using traditional recipes and fragrant spices.</div>

            <div className="hero-buttons">
              <Link href="/menu"><button className="btn-primary">View Menu →</button></Link>
              <a href="tel:+61882934249"><button className="btn-call">Call • +61 882 934 249</button></a>
            </div>
          </div>

          <div className="hero-right">
            <img src="/images/logo.png" alt="Sedap Eatery" className="hero-logo" />
          </div>
        </div>
      </section>

      <main>
        <section style={{ padding: "28px 20px" }}>
          <h2 style={{ fontSize: 28, color: "#4b231b" }}>Explore Our Menu</h2>
          <p style={{ color: "#4b3b34", maxWidth: 760 }}>Browse our full menu of Malaysian specialties. Order for pickup or delivery — classic flavours done right.</p>
          <div style={{ marginTop: 18 }}>
            <Link href="/menu"><button className="btn-primary">View Menu</button></Link>
          </div>
        </section>

        <div style={{ padding: "0 20px 80px" }}>
          <div className="footer-cta">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20 }}>Order your favourite today</div>
                <div>Pickup or delivery — fresh, fast, and delicious.</div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <a href="tel:+61882934249"><button className="btn-call">Call • +61 882 934 249</button></a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <a href="https://wa.me/61882934249" target="_blank" rel="noreferrer" className="whatsapp-float" aria-label="Message on WhatsApp">
        <img src="/images/whatsapp-icon.png" alt="WhatsApp" className="whatsapp-icon" />
      </a>
    </div>
  );
}
