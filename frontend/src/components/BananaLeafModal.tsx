import React, { useState } from "react";
import { VIEW_ONLY_MENU } from "../../config/appConfig";

import { useCart } from "../lib/cartContext";


type Addon = {
  id: string;
  title: string;
  desc: string;
  price: number;
};

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
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  if (!open || !baseItem) return null;

  const addons: Addon[] = [
    {
      id: "chicken-peratal",
      title: "Chicken Peratal",
      desc: "Tender chicken in peratal spice mix",
      price: 10.90,
    },
    {
      id: "chicken-varuval",
      title: "Chicken Varuval",
      desc: "Crispy spiced chicken stir-fry",
      price: 10.90,
    },
    {
      id: "mutton-varuval",
      title: "Mutton Varuval",
      desc: "Spicy dry-style mutton",
      price: 13.90,
    },
    {
      id: "mutton-peratal",
      title: "Mutton Peratal",
      desc: "Slow-cooked mutton in peratal sauce",
      price: 13.90,
    },
    {
      id: " potato-masala",
      title: "Potato Masala",
      desc: "Soft potatoes cooked in mild South Indian spices",
      price: 6.90,
    },
    {
      id: "prawn-sambal",
      title: "Prawn Sambal",
      desc: "Juicy prawns cooked in rich, spicy sambal sauce",
      price: 13.90,
    },
    {
      id: "tofu-sambal",
      title: "Tofu Sambal",
      desc: "Slow-cooked mutton in peratal sauce",
      price: 8.90,
    },
    {
      id: "fried-chicken",
      title: "Fried Chicken",
      desc: "Crispy Malaysian-style fried chicken, full of flavour",
      price: 10.90,
    },
    {
      id: "fried-chicken-pieces",
      title: "Fried Chicken Pieces",
      desc: "Bite-sized crispy fried chicken pieces",
      price: 10.90,
    },
    {
      id: "fried-fish",
      title: "Fried Fish",
      desc: "Lightly seasoned fish, fried until golden and crisp.",
      price: 11.90,
    },
  ];

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedAddonObjects = addons.filter((a) =>
    selectedAddons.includes(a.id)
  );

  const addonsTotal = selectedAddonObjects.reduce(
    (sum, a) => sum + a.price,
    0
  );

  const totalPrice = baseItem.price + addonsTotal;

  const addonTitles = selectedAddonObjects.map((a) => a.title).join(", ");

  const finalTitle =
    addonTitles.length > 0
      ? `${baseItem.title} (${addonTitles})`
      : baseItem.title;

  return (
    <div className="bl-modal-backdrop">
      <div className="bl-modal bl-banana">
        {/* CLOSE BUTTON */}
        <button className="bl-close-right" onClick={onClose}>
          ✕
        </button>

        {/* HEADER */}
        <div className="bl-header-block">
          <h2 className="bl-header">Customize: Banana Leaf Set</h2>
          <p className="bl-desc">
            A traditional South Indian banana leaf meal featuring three freshly
            prepared vegetable dishes, served with sambar, rasam, papadam &
            Kesari.
          </p>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="bl-content">
          {/* BASE MEAL */}
          <div className="bl-base-card">
            <div className="bl-base-title">
              Banana Leaf Set (Vegetarian)
            </div>
            <div className="bl-right">
              <span className="bl-item-price">
                ${baseItem.price.toFixed(2)}
              </span>
             {!VIEW_ONLY_MENU && ( <input type="radio" checked readOnly /> )}
            </div>
          </div>

          {/* ADD-ONS */}
          <div className="bl-section-title">Add-ons (optional)</div>

          <div className="bl-list">
            {addons.map((a) => (
              <div className="bl-item" key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <div className="bl-desc">{a.desc}</div>
                </div>

                <div className="bl-right">
                  <span className="bl-item-price">
                    ${a.price.toFixed(2)}
                  </span>
                  {!VIEW_ONLY_MENU && (<input
                    type="checkbox"
                    checked={selectedAddons.includes(a.id)}
                    onChange={() => toggleAddon(a.id)}
                  />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="bl-footer">
          <button className="variant-cancel" onClick={onClose}>
            Cancel
          </button>

          {!VIEW_ONLY_MENU && (<button
            className="variant-confirm"
            onClick={() => {
              addItem({
                id: baseItem.id,
                title: finalTitle,
                price: totalPrice,
                qty: 1,
              });
              onClose();
            }}
          >
            Add to Cart – ${totalPrice.toFixed(2)}
          </button>)}
        </div>
      </div>
    </div>
  );
}
