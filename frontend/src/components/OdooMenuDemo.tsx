import React, { useEffect, useState } from "react";
import { fetchOdooProducts } from "../lib/odooService";

type Product = {
  id: number;
  name: string;
  list_price: number;
};

export default function OdooMenuDemo() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOdooProducts()
      .then((data) => {
        if (data.success) {
          setProducts(data.products);
        } else {
          setError("Failed to load products");
        }
      })
      .catch(() => setError("Backend not reachable"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading Odoo menu…</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ color: "#FFD042" }}>Odoo Menu (Demo)</h2>

      {products.map((p) => (
        <div
          key={p.id}
          style={{
            background: "#5a2b1e",
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
            color: "#fff",
          }}
        >
          <strong>{p.name}</strong>
          <div>${p.list_price.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
