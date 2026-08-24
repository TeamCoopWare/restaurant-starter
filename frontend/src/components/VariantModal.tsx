import React, { useState, useEffect } from "react";
import { VIEW_ONLY_MENU } from "../../config/appConfig";
import { useCart } from "../lib/cartContext";

const RICE_OPTIONS = ["Jasmine Rice", "Coconut Rice"];

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
  const basePrice   = selectedVariant?.price ?? item.price ?? 0;
  const finalPrice  = basePrice + (eggObj?.price ?? 0) + (sambalObj?.price ?? 0);

  const handleAddToCart = () => {
    if (!canAdd) return;
    const descParts = [
      hasVariants ? selectedVariant?.title           : null,
      hasRice     ? riceType                         : null,
      eggObj?.price > 0   ? eggObj.title             : null,
      sambalObj?.price > 0 ? sambalObj.title         : null,
      hasSpice    ? spiceLevel + " spice"            : null,
    ].filter(Boolean);

    addItem({
      id:            item.id + "-" + (selectedVariantId ?? "base") + "-" + Date.now(),
      title:         item.title,
      qty:           1,
      price:         finalPrice,
      odooProductId: selectedVariant?.odooProductId ?? item.odooProductId,
      name:          descParts.length > 0
                       ? item.title + " (" + descParts.join(" | ") + ")"
                       : item.title,
    });
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
                key={rice} id={rice} label={rice}
                selected={riceType === rice}
                onSelect={() => setRiceType(rice)}
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
                : "Add to Cart – $" + finalPrice.toFixed(2)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}