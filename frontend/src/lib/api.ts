// Base URL of the ordering backend — MUST be set via NEXT_PUBLIC_API_URL at
// build time (e.g. http://localhost:4000 for dev, https://order.example.com in
// prod). No hardcoded fallback, so nothing host-specific is baked into the bundle.
export const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "";

// Product images are proxied through the backend so the Odoo host is never
// exposed to the browser. Returns null when there's no template id.
export function productImageUrl(templateId?: number | null): string | null {
  return templateId != null ? `${API_URL}/api/product-image/${templateId}` : null;
}
