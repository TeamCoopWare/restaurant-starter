import React, { useState, useEffect } from "react";
import { VIEW_ONLY_MENU } from "../../config/appConfig";
import { useCart } from "../lib/cartContext";

/* Rice is Odoo's "Choice" attribute: JASMINE RICE is free, COCONUT RICE has
   price_extra 2.00. The amount shown here must match Odoo, because Odoo is
   what actually gets charged — the checkout total comes from /api/quote. */
const RICE_OPTIONS = [
  { title: "Jasmine Rice", price: 0 },
  { title: "Coconut Rice", price: 2.0 },
];

export default function VariantModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item?: any;
}) {
  const { addItem } = useCart();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [eggOption,          setEggOption]         = useState<string>("");
  const [sambalOption,       setSambalOption]      = useState<string>("");
  const [spiceLevel,         setSpiceLevel]        = useState<string>("");
  const [riceType,           setRiceType]          = useState<string>("Jasmine Rice");

  useEffect(() => {
    if (!open || !item) return;
    setSelectedVariantId(null);
    setEggOption(item.options?.egg?.[0]?.id ?? "");
    setSambalOption(item.options?.sambal?.[0]?.id ?? "");
    setSpiceLevel(item.options?.spice?.[0] ?? "Less");
    setRiceType("Jasmine Rice");
  }, [open, item?.id]);

  if (!open || !item) return null;
  // v2 - custom RadioRow, no CSS classes

  const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;
  const hasEgg      = Array.isArray(item.options?.egg)    && item.options.egg.length > 0;
  const hasSambal   = Array.isArray(item.options?.sambal) && item.options.sambal.length > 0;
  const hasSpice    = Array.isArray(item.options?.spice)  && item.options.spice.length > 0;
  const hasRice     = !!item.options?.rice;
  const canAdd      = !hasVariants || selectedVariantId !== null;

  const selectedVariant = hasVariants
    ? item.variants.find((v: any) => v.id === selectedVariantId) ?? null
    : null;

  const eggObj    = hasEgg    ? item.options.egg.find((e: any) => e.id === eggOption)       : null;
  const sambalObj = hasSambal ? item.options.sambal.find((s: any) => s.id === sambalOption) : null;
  const riceObj     = hasRice ? RICE_OPTIONS.find((r) => r.title === riceType) : null;
  const basePrice   = selectedVariant?.price ?? item.price ?? 0;

  /* Extra Sambal Sauce is a real Odoo product (58), not an attribute of the
     dish, so it goes in the cart as its own line at Odoo's price. That keeps
     it sellable online without adding anything to the POS. Egg and rice ARE
     attributes of the dish, so they stay part of its unit price. */
  const sambalLine  = sambalObj?.odooProductId ? sambalObj : null;
  const finalPrice  = basePrice + (eggObj?.price ?? 0) + (riceObj?.price ?? 0);
  const cartTotal   = finalPrice + (sambalLine?.price ?? 0);

  const handleAddToCart = () => {
    if (!canAdd) return;
    const descParts = [
      hasVariants ? selectedVariant?.title           : null,
      hasRice     ? riceType                         : null,
      eggObj?.price > 0   ? eggObj.title             : null,
      hasSpice    ? spiceLevel + " spice"            : null,
    ].filter(Boolean);

    /* The options themselves, for Odoo. Unlike descParts (display text) these
       are the plain option labels the backend maps to Odoo attribute values,
       so the add-on is priced, recorded on the order and printed in the
       kitchen. Spice level is included even though it is free — the kitchen
       needs it. */
    const extras = [
      hasRice   ? riceType   : null,
      hasEgg    ? eggObj?.title    : null,
      hasSpice  ? spiceLevel : null,
    ].filter(Boolean) as string[];

    addItem({
      id:            item.id + "-" + (selectedVariantId ?? "base") + "-" + Date.now(),
      title:         item.title,
      qty:           1,
      price:         finalPrice,
      odooProductId: selectedVariant?.odooProductId ?? item.odooProductId,
      name:          descParts.length > 0
                       ? item.title + " (" + descParts.join(" | ") + ")"
                       : item.title,
      extras,
    });

    /* Same cart id as the standalone "Sambal Sauce" menu item, so ticking it
       here and adding it from the Add-ons section merge into one line. */
    if (sambalLine) {
      addItem({
        id:            "addon-sambal",
        title:         "Sambal Sauce",
        qty:           1,
        price:         sambalLine.price,
        odooProductId: sambalLine.odooProductId,
        name:          "Sambal Sauce",
      });
    }
    onClose();
  };

  // Reusable radio row — uses a plain <div> with no nested input onChange conflicts
  const RadioRow = ({ label, price, id, selected, onSelect }: {
    label: string; price?: number; id: string; selected: boolean; onSelect: () => void;
  }) => (
    <div
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", marginBottom: 8, borderRadius: 10,
        background: selected ? "rgba(255,208,66,0.15)" : "rgba(255,255,255,0.06)",
        border: "2px solid " + (selected ? "#FFD042" : "rgba(255,255,255,0.12)"),
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {price !== undefined && (
          <span style={{ color: "#FFD042", fontWeight: 700 }}>${price.toFixed(2)}</span>
        )}
        {/* Custom radio circle — no <input> to avoid double-fire */}
        <div style={{
          width: 20, height: 20, borderRadius: "50%",
          border: "2px solid " + (selected ? "#FFD042" : "rgba(255,255,255,0.4)"),
          background: selected ? "#FFD042" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3a1a0a" }} />}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="bl-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bl-modal variant-themed">
        <button className="variant-close-top" onClick={onClose}>✕</button>
        <h2 className="bl-header">{item.title}</h2>
        {item.description && <p className="bl-desc">{item.description}</p>}

        {/* VARIANTS */}
        {hasVariants && (
          <>
            <h4 className="bl-section-title">
              Protein <span style={{ color: "#e57373", fontSize: 12 }}>* required</span>
            </h4>
            {item.variants.map((v: any) => (
              <RadioRow
                key={v.id} id={v.id} label={v.title} price={v.price}
                selected={selectedVariantId === v.id}
                onSelect={() => setSelectedVariantId(v.id)}
              />
            ))}
          </>
        )}

        {/* RICE */}
        {hasRice && (
          <>
            <h4 className="bl-section-title">Rice Choice</h4>
            {RICE_OPTIONS.map((rice) => (
              <RadioRow
                key={rice.title} id={rice.title}
                label={rice.title + (rice.price > 0 ? " (+$" + rice.price.toFixed(2) + ")" : "")}
                selected={riceType === rice.title}
                onSelect={() => setRiceType(rice.title)}
              />
            ))}
          </>
        )}

        {/* EGG */}
        {hasEgg && (
          <>
            <h4 className="bl-section-title">Top-Up</h4>
            {item.options.egg.map((opt: any) => (
              <RadioRow
                key={opt.id} id={opt.id}
                label={opt.title + (opt.price > 0 ? " (+$" + opt.price.toFixed(2) + ")" : "")}
                selected={eggOption === opt.id}
                onSelect={() => setEggOption(opt.id)}
              />
            ))}
          </>
        )}

        {/* SAMBAL */}
        {hasSambal && (
          <>
            <h4 className="bl-section-title">Extra Sambal Sauce</h4>
            {item.options.sambal.map((opt: any) => (
              <RadioRow
                key={opt.id} id={opt.id}
                label={opt.title + (opt.price > 0 ? " (+$" + opt.price.toFixed(2) + ")" : "")}
                selected={sambalOption === opt.id}
                onSelect={() => setSambalOption(opt.id)}
              />
            ))}
          </>
        )}

        {/* SPICE */}
        {hasSpice && (
          <>
            <h4 className="bl-section-title">Spice Level</h4>
            {item.options.spice.map((lvl: string) => (
              <RadioRow
                key={lvl} id={lvl} label={lvl}
                selected={spiceLevel === lvl}
                onSelect={() => setSpiceLevel(lvl)}
              />
            ))}
          </>
        )}

        <div className="variant-actions">
          <button className="variant-cancel" onClick={onClose}>Close</button>
          {!VIEW_ONLY_MENU && (
            <button
              className="variant-confirm"
              disabled={!canAdd}
              style={{ opacity: canAdd ? 1 : 0.5, cursor: canAdd ? "pointer" : "not-allowed" }}
              onClick={handleAddToCart}
            >
              {!canAdd
                ? "Select a protein to continue"
                : "Add to Cart – $" + cartTotal.toFixed(2)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}