import React, { useState } from "react";
import { VIEW_ONLY_MENU } from "../../config/appConfig";


import Header from "../components/Header";
import BananaLeafModal from "../components/BananaLeafModal";
import VariantModal from "../components/VariantModal";
import { useCart } from "../lib/cartContext";
import menuData from "../../config/menuConfig.json";
import styles from "../styles/menu.module.css";

/* =========================
   TYPES
========================= */

export type MenuItem = {
  id: string;
  title: string;
  category?: string;
  price?: number;
  odooProductId?: number;
  description?: string;
  image?: string;

  variants?: {
    id: string;
    title: string;
    price: number;
  }[];

  options?: {
    egg?: boolean;
    spice?: boolean;
    rice?: boolean;
  };
};

/* =========================
   COMPONENT
========================= */

export default function MenuPage() {
  const { addItem, updateQty, items } = useCart();

  const [blOpen, setBlOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [bananaBase, setBananaBase] = useState<MenuItem | null>(null);

  const menuItems: MenuItem[] = Array.isArray(menuData.items)
    ? (menuData.items as MenuItem[])
    : [];

  const categories = menuItems.reduce<Record<string, MenuItem[]>>((acc, it) => {
    const cat = it.category ?? "Uncategorized";
    acc[cat] = acc[cat] || [];
    acc[cat].push(it);
    return acc;
  }, {});

  const order = [
    "Starters",
    "Rice Meals",
    "Nasi Lemak",
    "Noodles",
    "Banana Leaf Weekend Special",
    "Add-ons",
    "Kids",
    "Signature Malaysian Drinks",
    "Soft Drinks",
    "Dessert",
  ];

  const orderedKeys = [
    ...order.filter((k) => categories[k]),
    ...Object.keys(categories).filter((k) => !order.includes(k)),
  ];

  const getQty = (id: string) =>
    items.find((i: any) => i.id === id)?.qty ?? 0;

  return (
    <>
      <div className="menu-header">
        <Header shrinkOnScroll />
      </div>

      <main className={styles.menuPage}>
        <div style={{ height: "80px" }} />
        <h1 className={styles.menuTitle}>Full Menu</h1>

        {orderedKeys.map((cat) => (
          <section key={cat}>
            <h2 className={styles.categoryTitle}>{cat}</h2>

            {categories[cat].map((item) => {
              const isBanana =
                item.id === "banana-leaf-set" ||
                item.id === "banana-leaf-set-veg";

              const hasOptions =
                (item.variants && item.variants.length > 0) ||
                item.options?.egg ||
                item.options?.spice ||
                item.options?.rice;

              const qty = getQty(item.id);

              return (
                <div key={item.id} className={styles.menuRow}>
                  {/* LEFT */}
                  <div className={styles.menuLeft}>
                    <img
                      src={item.image ?? "/images/items/placeholder.jpg"}
                      className={styles.thumb}
                      alt={item.title}
                    />
                    <div>
                      <h3>{item.title}</h3>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className={styles.menuRight}>
{typeof item.price === "number" && (
  <div className={styles.menuPrice}>
    ${item.price.toFixed(2)}
  </div>
)}

                    {isBanana && (
                      <button
                        className={styles.addBtn}
                        onClick={() => {
                          setBananaBase(item);
                          setBlOpen(true);
                        }}
                      >
                        Customize
                      </button>
                    )}

                    {!isBanana && hasOptions && (
                      <button
                        className={styles.addBtn}
                        onClick={() => {
                          setSelectedItem(item);
                          setVariantOpen(true);
                        }}
                      >
                        Options
                      </button>
                    )}

                    {!VIEW_ONLY_MENU && !isBanana && !hasOptions && (
                      <div className={styles.qtyWrap}>
                        {qty === 0 ? (
                          <button
                            className={styles.addBtn}
                            onClick={() =>
                              addItem({
                                id: item.id,
                                title: item.title,
                                price: item.price ?? 0,
  odooProductId: item.odooProductId, // ✅ ADD THIS


                                qty: 1,
                              })
                            }
                          >
                            Add
                          </button>
                        ) : (
                          <>
                            <button
                              className={styles.qtyBtn}
                              onClick={() => updateQty(item.id, qty - 1)}
                            >
                              −
                            </button>
                            <span className={styles.qtyValue}>{qty}</span>
                            <button
                              className={styles.qtyBtn}
                              onClick={() => updateQty(item.id, qty + 1)}
                            >
                              +
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </main>

      <BananaLeafModal
        open={blOpen}
        onClose={() => setBlOpen(false)}
        baseItem={bananaBase}
      />

      <VariantModal
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        item={selectedItem ?? undefined}
      />

      <a
        href="https://wa.me/61460316046"
        target="_blank"
        rel="noreferrer"
        className="whatsapp-float"
      >
        <img
          src="/images/whatsapp-icon.png"
          alt="WhatsApp"
          className="whatsapp-icon"
        />
      </a>

      <footer className="footer">
        <div className="footer-inner site-container">
          <div className="footer-brand">Sedap Eatery</div>
          Shop #4, 10–26 Vale Ave, Valley View, SA
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
    </>
  );
}
