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

  const handleConfirm = () => {
    onConfirm?.(selected);
    onClose();
  };

  return (
    <div
      className="bl-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bl-modal">
        <button className="variant-close-top" onClick={onClose}>✕</button>

        <div className="bl-header">Customize — {item.title}</div>

        <div style={{ marginTop: 12 }}>
          {addons.length === 0 ? (
            <p style={{ opacity: 0.7, fontSize: 14 }}>No options available for this item.</p>
          ) : (
            addons.map((a: any) => {
              const isSelected = !!selected.find((x) => x.id === a.id);
              return (
                <div
                  key={a.id}
                  className="bl-item"
                  onClick={() => toggleAddon(a)}
                  style={{
                    cursor: "pointer",
                    opacity: isSelected ? 1 : 0.75,
                    background: isSelected ? "rgba(255,255,255,0.1)" : "transparent",
                    borderRadius: 8,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{a.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 800, color: "#8f3f2e" }}>
                      ${Number(a.price).toFixed(2)}
                    </span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAddon(a)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              );
            })
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18, gap: 10 }}>
            <button className="variant-cancel" onClick={onClose}>Cancel</button>
            <button className="variant-confirm" onClick={handleConfirm}>
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}