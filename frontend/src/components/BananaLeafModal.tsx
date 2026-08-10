import React, { useState, useEffect } from "react";
import { VIEW_ONLY_MENU } from "../../config/appConfig";
import { useCart } from "../lib/cartContext";
import { API_URL } from "../lib/api";

type BananaVariant = {
  id: string;
  title: string;
  price: number;       // full price (sent to cart/Odoo)
  addonPrice: number;  // displayed add-on cost (0 = base only)
  odooProductId: number;
};

const BASE_PRICE = 21.90;

// Fallback variants — confirmed from Odoo debug (product_id + lst_price)
// addonPrice = 0 means it IS the base; addonPrice > 0 is the extra charge
const FALLBACK_VARIANTS: BananaVariant[] = [
  { id: "bl-70", title: "None (Veg)",           odooProductId: 70, price: 21.90, addonPrice: 0     },
  { id: "bl-46", title: "Chicken Peratal",      odooProductId: 46, price: 32.80, addonPrice: 10.90 },
  { id: "bl-47", title: "Chicken Varuval",      odooProductId: 47, price: 32.80, addonPrice: 10.90 },
  { id: "bl-91", title: "Pepper Chicken",       odooProductId: 91, price: 32.80, addonPrice: 10.90 },
  { id: "bl-48", title: "Mutton Varuval",       odooProductId: 48, price: 35.80, addonPrice: 13.90 },
  { id: "bl-49", title: "Mutton Peratal",       odooProductId: 49, price: 35.80, addonPrice: 13.90 },
  { id: "bl-92", title: "Mutton Chettinad",     odooProductId: 92, price: 35.80, addonPrice: 13.90 },
  { id: "bl-68", title: "Potato Masala",        odooProductId: 68, price: 28.80, addonPrice:  6.90 },
  { id: "bl-69", title: "Prawn Samba",          odooProductId: 69, price: 35.80, addonPrice: 13.90 },
  { id: "bl-53", title: "Tofu Sambal",          odooProductId: 53, price: 30.80, addonPrice:  8.90 },
  { id: "bl-52", title: "Fried Fish",           odooProductId: 52, price: 30.80, addonPrice:  8.90 },
  { id: "bl-50", title: "Fried Chicken",        odooProductId: 50, price: 32.80, addonPrice: 10.90 },
  { id: "bl-51", title: "Fried Chicken Pieces", odooProductId: 51, price: 32.80, addonPrice: 10.90 },
];

export default function BananaLeafModal({
  open,
  onClose,
  baseItem,
}: {
  open: boolean;
  onClose: () => void;
  baseItem?: any;
}) {
  const { addItem } = useCart();
  const [variants,      setVariants]      = useState<BananaVariant[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [loadingAddons, setLoadingAddons] = useState(false);

  /* ── Fetch live variants from Odoo via /api/menu ── */
  useEffect(() => {
    if (!open || !baseItem) return;
    setSelectedId("bl-70"); // default to None/Vegetarian

    // If menu.tsx already passed bananaAddons (from Odoo), convert them to variants
    if (Array.isArray(baseItem.bananaAddons) && baseItem.bananaAddons.length > 0) {
      const basePrice = baseItem.price ?? 21.90;
      const liveVariants: BananaVariant[] = [
        { id: "bl-none", title: "None (Veg)", odooProductId: baseItem.odooProductId, price: basePrice, addonPrice: 0 },
        ...baseItem.bananaAddons.map((a: any) => ({
          id:            "bl-" + a.odooProductId,
          title:         a.title,
          odooProductId: a.odooProductId,
          price:         Math.round((basePrice + a.price) * 100) / 100,
          addonPrice:    a.price,
        })),
      ];
      setVariants(liveVariants);
      return;
    }

    // Otherwise fetch from backend
    setLoadingAddons(true);
    fetch(`${API_URL}/api/menu`)
      .then((r) => r.json())
      .then((data: any[]) => {
        const bananaOdoo = data.find((p: any) =>
          p.name?.toLowerCase().includes("banana leaf set")
        );
        if (!bananaOdoo || !bananaOdoo.variants?.length) {
          setVariants(FALLBACK_VARIANTS);
          return;
        }

        const basePrice = bananaOdoo.variants.find((v: any) => v.variant === "None")?.price ?? 21.90;
        const liveVariants: BananaVariant[] = bananaOdoo.variants.map((v: any) => ({
          id:            "bl-" + v.product_id,
          title:         v.variant === "None" ? "None (Veg)" : v.variant,
          odooProductId: v.product_id,
          price:         v.price,
          addonPrice:    v.variant === "None" ? 0 : Math.round((v.price - basePrice) * 100) / 100,
        }));

        // Put "None/Vegetarian" first
        liveVariants.sort((a, b) =>
          a.title.toLowerCase().includes("vegetarian") ? -1 :
          b.title.toLowerCase().includes("vegetarian") ? 1 : 0
        );

        const finalVariants = liveVariants.length > 0 ? liveVariants : FALLBACK_VARIANTS;
        setVariants(finalVariants);
        // Pre-select the "None" variant (first one)
        if (finalVariants.length > 0) setSelectedId(finalVariants[0].id);
        console.log("✅ Banana Leaf: " + liveVariants.length + " variants loaded from Odoo");
      })
      .catch(() => setVariants(FALLBACK_VARIANTS))
      .finally(() => setLoadingAddons(false));
  }, [open, baseItem]);

  if (!open || !baseItem) return null;

  const displayVariants = variants.length > 0 ? variants : FALLBACK_VARIANTS;
  const selectedVariant = displayVariants.find((v) => v.id === selectedId) ?? null;
  const canAdd = selectedVariant !== null || displayVariants.length > 0;

  const handleAddToCart = () => {
    if (!canAdd || !selectedVariant) return;
    addItem({
      id:            "banana-leaf-" + selectedVariant.odooProductId + "-" + Date.now(),
      title:         "Banana Leaf Set (" + selectedVariant.title + ")",
      price:         selectedVariant.price,
      qty:           1,
      odooProductId: selectedVariant.odooProductId,
      name:          "Banana Leaf Set (" + selectedVariant.title + ")",
    });
    onClose();
  };

  // Custom radio row — no HTML inputs to avoid double-fire
  const RadioRow = ({ variant }: { variant: BananaVariant }) => {
    const isSelected = selectedId === variant.id;
    return (
      <div
        onClick={() => setSelectedId(variant.id)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 8, borderRadius: 10,
          background: isSelected ? "rgba(255,208,66,0.15)" : "rgba(255,255,255,0.06)",
          border: "2px solid " + (isSelected ? "#FFD042" : "rgba(255,255,255,0.12)"),
          cursor: "pointer", transition: "all 0.15s",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15 }}>{variant.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {variant.addonPrice === 0
            ? <span style={{ color: "#FFD042", fontWeight: 700, fontSize: 15 }}>${variant.price.toFixed(2)}</span>
            : <span style={{ color: "#FFD042", fontWeight: 700, fontSize: 15 }}>+ ${variant.addonPrice.toFixed(2)}</span>
          }
          <div style={{
            width: 20, height: 20, borderRadius: "50%",
            border: "2px solid " + (isSelected ? "#FFD042" : "rgba(255,255,255,0.4)"),
            background: isSelected ? "#FFD042" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3a1a0a" }} />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bl-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bl-modal bl-banana">
        <button className="bl-close-right" onClick={onClose}>✕</button>

        <div className="bl-header-block">
          <h2 className="bl-header">Banana Leaf Set</h2>
          <p className="bl-desc">
            A traditional South Indian banana leaf meal featuring three freshly
            prepared vegetable dishes, served with sambar, rasam, papadam &amp; Kesari.
            Base price: <strong style={{color:"#FFD042"}}>${BASE_PRICE.toFixed(2)}</strong> — choose your protein add-on below.
          </p>
        </div>

        <div className="bl-content">
          {/* None (Veg) always shown first, above the protein section */}
          {!loadingAddons && displayVariants.length > 0 && (
            <RadioRow key={displayVariants[0].id} variant={displayVariants[0]} />
          )}

          <h4 className="bl-section-title" style={{ marginTop: 16 }}>
            Choose Protein&nbsp;
            <span style={{ color: "#e57373", fontSize: 12, fontWeight: 400 }}>* required</span>
          </h4>

          {loadingAddons ? (
            <div style={{ padding: "16px 0", opacity: 0.7, fontSize: 14 }}>
              Loading options from Odoo...
            </div>
          ) : (
            displayVariants.slice(1).map((v) => <RadioRow key={v.id} variant={v} />)
          )}
        </div>

        <div className="bl-footer">
          <button className="variant-cancel" onClick={onClose}>Cancel</button>
          {!VIEW_ONLY_MENU && (
            <button
              className="variant-confirm"
              disabled={!canAdd}
              style={{ opacity: canAdd ? 1 : 0.5, cursor: canAdd ? "pointer" : "not-allowed" }}
              onClick={handleAddToCart}
            >
              {canAdd && selectedVariant
                ? "Add to Cart – $" + selectedVariant.price.toFixed(2)
                : "Select an option to continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}