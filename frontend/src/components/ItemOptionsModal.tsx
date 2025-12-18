import React, { useState } from "react";

export default function ItemOptionsModal({
  open,
  onClose,
  item,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  item?: any;
  onConfirm?: (addons: any[]) => void;
}) {
  const [selected, setSelected] = useState<any[]>([]);
  if (!open || !item) return null;

  const addons = Array.isArray(item.addons) ? item.addons : [];

  const toggleAddon = (addon: any) => {
    setSelected((prev) =>
      prev.find((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, { ...addon, qty: 1 }]
    );
  };

  return (
    <div
      className="bl-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bl-modal">
        <div className="bl-header">
          Customize — {item.title}
        </div>

        <div style={{ marginTop: 12 }}>
          {addons.map((a: any) => (
            <div
              key={a.id}
              className="bl-item"
              onClick={() => toggleAddon(a)}
              style={{ cursor: "pointer", opacity: selected.find(x => x.id === a.id) ? 1 : 0.7 }}
            >
              <div style={{ fontWeight: 800 }}>{a.title}</div>
              <div style={{ fontWeight: 800, color: "#8f3f2e" }}>
                ${Number(a.price).toFixed(2)}
              </div>
            </div>
          ))}

          {/* ACTIONS */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 18,
              gap: 10,
            }}
          >
            <button className="close" onClick={onClose}>
              Cancel
            </button>
            <button
              className="close"
              onClick={() => onConfirm?.(selected)}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
