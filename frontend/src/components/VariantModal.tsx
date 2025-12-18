import React, { useState } from "react";
import { VIEW_ONLY_MENU } from "../../config/appConfig";
import { useCart } from "../lib/cartContext";

const SPICE_LEVELS = ["Less", "Mild", "Spicy", "Extra Spicy"];
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

  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [eggOption, setEggOption] = useState<"egg" | "no-egg">("no-egg");
  const [spiceLevel, setSpiceLevel] = useState<string>("Mild");
  const [riceType, setRiceType] = useState<string>("Jasmine Rice");

  if (!open || !item) return null;

  const hasVariants = item.variants?.length > 0;
  const hasEgg = item.options?.egg;
  const hasSpice = item.options?.spice;
  const hasRice = item.options?.rice;

  return (
    <div className="bl-modal-backdrop">
      <div className="bl-modal variant-themed">
        <h2 className="bl-header">{item.title}</h2>
        {item.description && <p className="bl-desc">{item.description}</p>}

        {/* PROTEIN VARIANTS */}
        {hasVariants && (
          <>
            <h4 className="bl-section-title">Protein</h4>
            <div className="variant-list">
              {item.variants.map((v: any) => (
                <label key={v.id} className="variant-row radio-row">
                  <div className="variant-text">
                    <span className="variant-label">{v.title}</span>
                  </div>
                  <div className="variant-right">
                    <span className="variant-price">
                      ${v.price.toFixed(2)}
                    </span>
                    <input
                      type="radio"
                      checked={selectedVariant?.id === v.id}
                      onChange={() => setSelectedVariant(v)}
                    />
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {/* RICE TYPE */}
        {hasRice && (
          <>
            <h4 className="bl-section-title">Rice Choice</h4>
            <div className="variant-list">
              {RICE_OPTIONS.map((rice) => (
                <label key={rice} className="variant-row radio-row">
                  <span className="variant-label">{rice}</span>
                  <input
                    type="radio"
                    checked={riceType === rice}
                    onChange={() => setRiceType(rice)}
                  />
                </label>
              ))}
            </div>
          </>
        )}

        {/* FRIED EGG */}
        {hasEgg && (
          <>
            <h4 className="bl-section-title">Fried Egg</h4>
            <div className="variant-list">
              <label className="variant-row radio-row">
                <span className="variant-label">No Fried Egg</span>
                <input
                  type="radio"
                  checked={eggOption === "no-egg"}
                  onChange={() => setEggOption("no-egg")}
                />
              </label>

              <label className="variant-row radio-row">
                <span className="variant-label">
                  Add Fried Egg (+$2.00)
                </span>
                <input
                  type="radio"
                  checked={eggOption === "egg"}
                  onChange={() => setEggOption("egg")}
                />
              </label>
            </div>
          </>
        )}

        {/* SPICE LEVEL */}
        {hasSpice && (
          <>
            <h4 className="bl-section-title">Spice Level</h4>
            <div className="variant-list">
              {SPICE_LEVELS.map((lvl) => (
                <label key={lvl} className="variant-row radio-row">
                  <span className="variant-label">{lvl}</span>
                  <input
                    type="radio"
                    checked={spiceLevel === lvl}
                    onChange={() => setSpiceLevel(lvl)}
                  />
                </label>
              ))}
            </div>
          </>
        )}

        {/* FOOTER */}
        <div className="variant-actions">
          <button className="variant-cancel" onClick={onClose}>
            Close
          </button>

          {!VIEW_ONLY_MENU && (
            <button
              className="variant-confirm"
              disabled={hasVariants && !selectedVariant}
              onClick={() => {
                const basePrice =
                  selectedVariant?.price ?? item.price ?? 0;
                const eggPrice = eggOption === "egg" ? 2 : 0;

                addItem({
                  id: `${item.id}-${selectedVariant?.id ?? "base"}`,
                  title: item.title,
                  price: basePrice + eggPrice,
                  qty: 1,
                 
                });

                onClose();
              }}
            >
              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
