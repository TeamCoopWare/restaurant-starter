export async function fetchOdooProducts() {
  const res = await fetch("http://localhost:4000/odoo/products");
  if (!res.ok) {
    throw new Error("Failed to fetch Odoo products");
  }
  return res.json();
}
