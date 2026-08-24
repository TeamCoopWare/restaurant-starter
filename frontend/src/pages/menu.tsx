import React, { useState, useEffect } from "react";
import { VIEW_ONLY_MENU } from "../../config/appConfig";

import Header from "../components/Header";
import BananaLeafModal from "../components/BananaLeafModal";
import VariantModal from "../components/VariantModal";
import { useCart } from "../lib/cartContext";
import { API_URL, productImageUrl } from "../lib/api";
import { isClosedToday, CLOSED_DAYS_LABEL, OPEN_DAYS_LABEL, TESTING_MODE } from "../lib/hours";
import staticMenuData from "../../config/menuConfig.json";
import styles from "../styles/menu.module.css";

/* =========================
   TYPES
========================= */

export type BananaAddon = {
  id: string;
  title: string;
  desc: string;
  price: number;
  odooProductId: number;
};

export type MenuItem = {
  id: string;
  title: string;
  category?: string;
  price?: number;
  odooProductId?: number;
  description?: string;
  image?: string;

  variants?: {
    id: string;
    title: string;
    price: number;
    odooProductId?: number;
  }[];

  options?: {
    egg?: any[];
    sambal?: any[];
    spice?: any[];
    rice?: boolean;
  };

  // Populated from Odoo for the Banana Leaf Set
  bananaAddons?: BananaAddon[];
};

/* =========================
   BANANA LEAF ADD-ON DESCRIPTIONS
   Keyed by the variant name Odoo returns.
========================= */
const BANANA_ADDON_DESCS: Record<string, string> = {
  "Chicken Peratal":      "Tender chicken in peratal spice mix",
  "Chicken Varuval":      "Crispy spiced chicken stir-fry",
  "Pepper Chicken":       "Spicy pepper chicken stir-fry",
  "Mutton Varuval":       "Spicy dry-style mutton",
  "Mutton Peratal":       "Slow-cooked mutton in peratal sauce",
  "Mutton Chettinad":     "Slow-cooked mutton in chettinad sauce",
  "Potato Masala":        "Soft potatoes cooked in mild South Indian spices",
  "Prawn Samba":          "Juicy prawns cooked in rich, spicy sambal sauce",
  "Prawn Sambal":         "Juicy prawns cooked in rich, spicy sambal sauce",
  "Tofu Sambal":          "Slow-cooked tofu in sambal sauce",
  "Fried Chicken":        "Crispy Malaysian-style fried chicken, full of flavour",
  "Fried Chicken Pieces": "Bite-sized crispy fried chicken pieces",
  "Fried Fish":           "Lightly seasoned fish, fried until golden and crisp",
};

/* =========================
   INTERNAL ITEM FILTER
   Skip Odoo products that are POS modifiers or admin-only.
========================= */
const SKIP_EXACT = new Set([
  "holiday surcharge",
  "transaction charges",
  "takeaway box",
]);

/* Map Odoo product name keywords → correct menu category.
   Add entries here whenever a new Odoo product should go
   into a specific category instead of "New Items".        */
const ODOO_CATEGORY_MAP: { keyword: string; category: string }[] = [
  // Banana Leaf
  { keyword: "banana leaf",   category: "Banana Leaf Weekend Special" },
  { keyword: "add on",        category: "Banana Leaf Weekend Lunch Special" },
  { keyword: "add-on",        category: "Banana Leaf Weekend Lunch Special" },
  // Rice
  { keyword: "nasi lemak",    category: "Nasi Lemak" },
  { keyword: "nasi",          category: "Rice Meals" },
  { keyword: "rice",          category: "Rice Meals" },
  // Noodles
  { keyword: "mee goreng",    category: "Noodles" },
  { keyword: "laksa",         category: "Noodles" },
  { keyword: "mee",           category: "Noodles" },
  { keyword: "noodle",        category: "Noodles" },
  { keyword: "koay teow",     category: "Noodles" },
  { keyword: "maggi",         category: "Noodles" },
  // Starters
  { keyword: "roti",          category: "Starters" },
  { keyword: "spring roll",   category: "Starters" },
  { keyword: "samosa",        category: "Starters" },
  { keyword: "curry puff",    category: "Starters" },
  // Drinks
  { keyword: "teh tarik",     category: "Signature Malaysian Drinks" },
  { keyword: "teh",           category: "Signature Malaysian Drinks" },
  { keyword: "milo",          category: "Signature Malaysian Drinks" },
  { keyword: "sirap",         category: "Signature Malaysian Drinks" },
  { keyword: "chai",          category: "Signature Malaysian Drinks" },
  { keyword: "karak",         category: "Signature Malaysian Drinks" },
  { keyword: "lassi",         category: "Signature Malaysian Drinks" },
  { keyword: "juice",         category: "Signature Malaysian Drinks" },
  { keyword: "bandung",       category: "Signature Malaysian Drinks" },
  { keyword: "coffee",        category: "Signature Malaysian Drinks" },
  { keyword: "kopi",          category: "Signature Malaysian Drinks" },
  // Soft Drinks
  { keyword: "coke",          category: "Soft Drinks" },
  { keyword: "pepsi",         category: "Soft Drinks" },
  { keyword: "mineral water", category: "Soft Drinks" },
  // Dessert
  { keyword: "cendol",        category: "Dessert" },
  { keyword: "ice cream",     category: "Dessert" },
  { keyword: "pudding",       category: "Dessert" },
  { keyword: "kuih",          category: "Dessert" },
  // Kids
  { keyword: "kids",          category: "Kids" },
];

function mapOdooCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const { keyword, category } of ODOO_CATEGORY_MAP) {
    if (lower.includes(keyword)) return category;
  }
  return "New Items";
}

function isInternalItem(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (SKIP_EXACT.has(lower)) return true;
  if (lower.includes("not for sale")) return true;
  if (lower.includes("test product")) return true;
  return false;
}

/* =========================
   IMAGE RESOLUTION
   Order of preference:
     1. Local image from menuConfig.json, matched by Odoo product id.
     2. Odoo product image, proxied through the backend
        ({API_URL}/api/product-image/{template_id}) so the Odoo host is never
        exposed to the browser.
     3. Placeholder (also used via <img onError> if the image 404s).
========================= */
const PLACEHOLDER_IMG = "/images/items/placeholder.png";

const MENU_CACHE_KEY = "sedap_menu_cache";

const odooImageUrl = productImageUrl;

/* A curated local image (anything other than the generic placeholder) wins.
   Otherwise use the Odoo image if we have a template id, else the placeholder. */
function resolveImage(
  localImage: string | undefined,
  templateId?: number | null
): string {
  if (localImage && localImage !== PLACEHOLDER_IMG) return localImage;
  return odooImageUrl(templateId) ?? PLACEHOLDER_IMG;
}

/* =========================
   BUILD MENU FROM ODOO  (Odoo = single source of truth)
   The live Odoo response drives what appears and what is orderable.
   The static menuConfig.json is used ONLY as a metadata layer here
   (curated image / description / category / options), matched to Odoo
   by product id. A static item with no matching id in the live Odoo
   response is dropped — it never becomes independently orderable.
   Any NEW Odoo product not in static config appears under "New Items".
========================= */
function buildFullMenu(odooData: any[], staticItems: MenuItem[]): MenuItem[] {
  /* ---- Odoo-derived lookups: price, live ids, template id (for images) ---- */
  const priceMap = new Map<number, number>();
  const liveIds = new Set<number>();
  const templateByProductId = new Map<number, number | null>();
  // Odoo product image URL needs the product.template id — but only use it when
  // Odoo actually HAS an image for that template (`has_image`). Otherwise Odoo's
  // /web/image returns its default grey silhouette (HTTP 200), which would mask
  // our own PLACEHOLDER_IMG. When there's no Odoo image we return null so the
  // resolver falls back to the curated local image / placeholder instead.
  const templateIdOf = (p: any): number | null =>
    p?.has_image ? p?.template_id ?? null : null;

  for (const p of odooData) {
    for (const v of p.variants ?? []) {
      if (v.product_id == null) continue;
      priceMap.set(v.product_id, v.price);
      liveIds.add(v.product_id);
      templateByProductId.set(v.product_id, templateIdOf(p));
    }
  }

  /* ---- Step 1: enrich static items with Odoo prices + resolved images ---- */
  const merged: MenuItem[] = staticItems.map((item) => {
    const updated: MenuItem = { ...item };
    if (item.odooProductId && priceMap.has(item.odooProductId)) {
      updated.price = priceMap.get(item.odooProductId);
    }
    // Representative Odoo id for this item (own id, else first variant id).
    const repId =
      item.odooProductId ??
      item.variants?.find((v) => v.odooProductId)?.odooProductId ??
      null;
    updated.image = resolveImage(
      item.image,
      repId != null ? templateByProductId.get(repId) ?? null : null
    );
    if (item.variants) {
      updated.variants = item.variants.map((v) =>
        v.odooProductId && priceMap.has(v.odooProductId)
          ? { ...v, price: priceMap.get(v.odooProductId)! }
          : v
      );
    }
    return updated;
  });

  /* ---- Step 1b: inject Banana Leaf add-ons from Odoo ---- */
  const bananaOdoo = odooData.find((p: any) =>
    p.name?.toLowerCase().includes("banana leaf set")
  );
  if (bananaOdoo) {
    const baseVariant = bananaOdoo.variants.find((v: any) => v.variant === "None");
    const basePrice: number = baseVariant?.price ?? 21.9;

    const bananaItem = merged.find(
      (m) => m.id === "banana-leaf-set-veg" || m.id === "banana-leaf-set"
    );
    if (bananaItem) {
      bananaItem.bananaAddons = bananaOdoo.variants
        .filter((v: any) => v.variant !== "None")
        .map((v: any) => ({
          id:           `bl-addon-${v.product_id}`,
          title:        v.variant,
          desc:         BANANA_ADDON_DESCS[v.variant] ?? "",
          price:        Math.round((v.price - basePrice) * 100) / 100,
          odooProductId: v.product_id,
        }));
      console.log(`✅ Banana Leaf: ${bananaItem.bananaAddons?.length} add-ons loaded from Odoo (base $${basePrice})`);
    }
  }

  /* ---- Step 2: collect all product_ids already covered by static ---- */
  const coveredIds = new Set<number>();
  for (const item of staticItems) {
    if (item.odooProductId) coveredIds.add(item.odooProductId);
    for (const v of item.variants ?? []) {
      if (v.odooProductId) coveredIds.add(v.odooProductId);
    }
  }

  /* ---- Step 3: find Odoo products not yet covered ---- */
  const newItems: MenuItem[] = [];

  for (const odooProduct of odooData) {
    const name = (odooProduct.name ?? "").trim();
    const variants: any[] = odooProduct.variants ?? [];

    if (isInternalItem(name)) continue;

    // Skip if ALL variants are covered (already shown via static items)
    if (variants.every((v: any) => coveredIds.has(v.product_id))) continue;

    // Skip if the base variant (Standard / None) is already covered —
    // means a static item represents this product (e.g. Banana Leaf Set)
    const baseVariantCovered = variants.some(
      (v: any) =>
        coveredIds.has(v.product_id) &&
        (v.variant === "Standard" || v.variant === "None")
    );
    if (baseVariantCovered) continue;

    const isSimple =
      variants.length === 1 && variants[0].variant === "Standard";

    if (isSimple) {
      const v = variants[0];
      if (v.price === 0) continue; // skip zero-price
      newItems.push({
        id:           `odoo-${v.product_id}`,
        title:        name,
        category:     mapOdooCategory(name),
        price:        v.price,
        odooProductId: v.product_id,
        description:  "",
        image:        resolveImage(undefined, templateIdOf(odooProduct)),
      });
    } else {
      const displayVariants = variants.filter(
        (v) => v.variant !== "Standard"
      );
      if (!displayVariants.length) continue;

      newItems.push({
        id:           `odoo-multi-${variants[0].product_id}`,
        title:        name,
        category:     mapOdooCategory(name),
        price:        Math.min(...displayVariants.map((v) => v.price)),
        odooProductId: variants[0].product_id,
        description:  "",
        image:        resolveImage(undefined, templateIdOf(odooProduct)),
        variants:     displayVariants.map((v) => ({
          id:           `odoo-v-${v.product_id}`,
          title:        v.variant === "None" ? "Vegetarian" : v.variant,
          price:        v.price,
          odooProductId: v.product_id,
        })),
      });
    }
  }

  /* ---- Step 4: enforce Odoo as source of truth ----
     Keep a static item only if it has a live Odoo match:
       • variant item  → keep only the variants whose id is live; drop item
                         if none remain (unless its own base id is live).
       • simple item   → keep only if its odooProductId is live.
     Static items with no live match (e.g. odooProductId 0) are dropped so
     they can never be ordered while Odoo is the source of truth. */
  const mergedLive: MenuItem[] = [];
  for (const item of merged) {
    if (item.variants && item.variants.length) {
      const liveVariants = item.variants.filter(
        (v) => v.odooProductId != null && liveIds.has(v.odooProductId)
      );
      if (liveVariants.length) {
        mergedLive.push({ ...item, variants: liveVariants });
      } else if (item.odooProductId && liveIds.has(item.odooProductId)) {
        const { variants, ...rest } = item;
        mergedLive.push(rest);
      }
      // else: no live variant and no live base → drop
    } else if (item.odooProductId && liveIds.has(item.odooProductId)) {
      mergedLive.push(item);
    }
    // else: simple item not present in Odoo → drop
  }

  return [...mergedLive, ...newItems];
}

/* =========================
   CATEGORY ORDER
========================= */
const CATEGORY_ORDER = [
  "Starters",
  "Rice Meals",
  "Nasi Lemak",
  "Noodles",
  "Banana Leaf Weekend Special",
  "Banana Leaf Weekend Lunch Special",
  "Add-ons",
  "Kids",
  "Signature Malaysian Drinks",
  "Soft Drinks",
  "Dessert",
  "New Items", // auto-populated from new Odoo products
];

/* =========================
   WEEKEND CHECK
   Banana Leaf is only available Sat & Sun — evaluated in the restaurant's
   timezone (NEXT_PUBLIC_TIMEZONE, default Australia/Adelaide), not the
   visitor's local zone, so it flips at the right moment for everyone.
========================= */
const RESTAURANT_TZ =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TIMEZONE) ||
  "Australia/Adelaide";

function isWeekend(): boolean {
  if (TESTING_MODE) return true;   // testing: treat every day as weekend so weekend-only items are orderable
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TZ,
    weekday: "short",
  }).format(new Date());
  return weekday === "Sat" || weekday === "Sun";
}

const WEEKEND_ONLY_ITEMS = new Set([
  "banana-leaf-set-veg",
  "banana-leaf-set",
]);

// These items require a Banana Leaf Set to be in the cart first
const REQUIRES_BANANA_LEAF = (item: any): boolean => {
  const title = (item.title ?? "").toLowerCase();
  const id    = (item.id    ?? "").toLowerCase();
  return title.includes("add on") || title.includes("add-on") ||
         id.includes("add-on")    || id.includes("addon") ||
         title.includes("extra");
};

// Check if any banana leaf base is in the cart
const hasBananaLeafInCart = (cartItems: any[]): boolean =>
  cartItems.some((i: any) =>
    i.id?.includes("banana-leaf") ||
    i.odooProductId === 70 ||
    (i.name ?? i.title ?? "").toLowerCase().includes("banana leaf set")
  );

/* =========================
   COMPONENT
========================= */

export default function MenuPage() {
  const { addItem, updateQty, items } = useCart();
  const [posOpen,      setPosOpen]      = useState<boolean>(true);
  const [holidayActive, setHolidayActive] = useState<boolean>(false);
  // Closed on Mon & Tue. Computed client-side (in the restaurant TZ) after mount
  // to avoid a static-export/hydration mismatch on the build-time day.
  const [closedToday,  setClosedToday]  = useState<boolean>(false);

  useEffect(() => {
    setClosedToday(isClosedToday());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/holiday/status`)
      .then((r) => r.json())
      .then((data) => setHolidayActive(data.active))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/pos-status`)
      .then((r) => r.json())
      .then((data) => setPosOpen(data.open))
      .catch(() => setPosOpen(true)); // assume open if can't reach backend
  }, []);

  const [blOpen,       setBlOpen]      = useState(false);
  const [variantOpen,  setVariantOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [bananaBase,   setBananaBase]  = useState<MenuItem | null>(null);

  /* Odoo is the source of truth. We start empty (no orderable static items)
     and populate from the live Odoo response — or, if Odoo is unreachable,
     from the last cached Odoo response, or finally from static config as a
     READ-ONLY display.
       "live"   → fresh Odoo response
       "cache"  → last cached Odoo response (Odoo currently unreachable)
       "static" → offline fallback, read-only (ordering disabled)
       "loading"→ waiting on first response */
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuSource, setMenuSource] =
    useState<"loading" | "live" | "cache" | "static">("loading");

  /* Load the menu from Odoo (single source of truth). On success we render
     from the Odoo response and cache it. Only if the fetch fails do we fall
     back to the cached Odoo response, then to static menuConfig.json — and
     static is treated as a read-only display, never independently orderable. */
  useEffect(() => {
    // NOTE: static menuConfig.json is an OFFLINE FALLBACK CACHE ONLY.
    // It provides display metadata + a last-resort read-only menu; it is
    // never a source of independently-orderable items.
    const staticItems = Array.isArray(staticMenuData.items)
      ? (staticMenuData.items as MenuItem[])
      : [];

    // Show the last cached Odoo response immediately if available
    let hadCache = false;
    try {
      const cached = localStorage.getItem(MENU_CACHE_KEY);
      if (cached) {
        const cachedData = JSON.parse(cached);
        if (Array.isArray(cachedData) && cachedData.length > 0) {
          const full = buildFullMenu(cachedData, staticItems);
          setMenuItems(full);
          setMenuSource("cache");
          hadCache = true;
          console.log(`📦 Menu loaded from cached Odoo response (${full.length} items)`);
        }
      }
    } catch (e) {}

    // Then try to fetch fresh from Odoo — the source of truth
    fetch(`${API_URL}/api/menu`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Empty Odoo menu response");
        }
        const full = buildFullMenu(data, staticItems);
        setMenuItems(full);
        setMenuSource("live");
        // Cache the successful Odoo response for offline fallback
        try {
          localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
        } catch (e) {}
        console.log(`✅ Menu loaded from Odoo (${full.length} items)`);
      })
      .catch(() => {
        // Odoo unavailable. Keep the cached Odoo menu if we already showed it;
        // otherwise fall back to static menuConfig.json as a READ-ONLY display.
        if (hadCache) {
          console.log("⚠️ Odoo unavailable — using cached Odoo menu");
          return;
        }
        setMenuItems(staticItems);
        setMenuSource("static");
        console.log("⚠️ Odoo unavailable and no cache — static read-only menu");
      });
  }, []);

  const categories = menuItems.reduce<Record<string, MenuItem[]>>((acc, it) => {
    const cat = it.category ?? "Uncategorized";
    acc[cat] = acc[cat] || [];
    acc[cat].push(it);
    return acc;
  }, {});

  const orderedKeys = [
    ...CATEGORY_ORDER.filter((k) => categories[k]),
    ...Object.keys(categories).filter((k) => !CATEGORY_ORDER.includes(k)),
  ];

  const getQty = (id: string) =>
    items.find((i: any) => i.id === id)?.qty ?? 0;

  // Static fallback is a read-only display — ordering is disabled there.
  // Ordering is also disabled on closed days (Mon & Tue).
  const readOnly = menuSource === "static";
  const canOrder = posOpen && !readOnly && !closedToday;

  return (
    <>
      <div className="menu-header">
        <Header shrinkOnScroll />
      </div>

      <main className={styles.menuPage}>
        <div style={{ height: "80px" }} />
        <h1 className={styles.menuTitle}>Full Menu</h1>

        {/* Always-visible trading hours */}
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
          🕒 {OPEN_DAYS_LABEL} · {CLOSED_DAYS_LABEL}
        </p>

        {/* Closed today (Mon & Tue) — takes precedence over the generic notice */}
        {closedToday ? (
          <div style={{
            background: "#c0392b", color: "#fff", borderRadius: 10,
            padding: "12px 18px", marginBottom: 18, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 10, fontSize: 15,
          }}>
            <span>🔒</span>
            <span>We're closed today — Sedap is closed Mondays &amp; Tuesdays. Browse the menu and order again from Wednesday!</span>
          </div>
        ) : !posOpen && (
          <div style={{
            background: "#c0392b", color: "#fff", borderRadius: 10,
            padding: "12px 18px", marginBottom: 18, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 10, fontSize: 15,
          }}>
            <span>🔒</span>
            <span>Online ordering is currently closed. Browse our menu and come back during opening hours!</span>
          </div>
        )}

        {holidayActive && (
          <div style={{
            background: "rgba(240,165,0,0.15)", borderRadius: 10,
            padding: "12px 18px", marginBottom: 18,
            border: "2px solid #f0a500",
            display: "flex", alignItems: "center", gap: 10, fontSize: 14,
          }}>
            <span>🎌</span>
            <span style={{ fontWeight: 600, color: "#FFD042" }}>
              Public holiday surcharge of 10% applies to all orders today.
            </span>
          </div>
        )}

        {(menuSource === "live" || menuSource === "cache") && (
          <p style={{ fontSize: 12, opacity: 0.55, marginBottom: 8 }}>
            Live menu
          </p>
        )}

        {orderedKeys.map((cat) => (
          <section key={cat}>
            <h2 className={styles.categoryTitle}>{cat}</h2>

            {categories[cat].map((item) => {
              const isBanana =
                item.id === "banana-leaf-set" ||
                item.id === "banana-leaf-set-veg";
              const isWeekendOnly = WEEKEND_ONLY_ITEMS.has(item.id) ||
                (item.title ?? "").toLowerCase().includes("add on") ||
                (item.title ?? "").toLowerCase().includes("add-on") ||
                (item.title ?? "").toLowerCase().includes("banana leaf");
              const isBananaLeafBase = (item.title ?? "").toLowerCase().includes("banana leaf");
              const weekendAvailable = !isWeekendOnly || isWeekend();
              const needsBananaLeaf  = REQUIRES_BANANA_LEAF(item);
              const bananaInCart     = needsBananaLeaf && hasBananaLeafInCart(items);

              const hasOptions =
                (item.variants && item.variants.length > 0) ||
                item.options?.egg ||
                item.options?.spice ||
                item.options?.rice;

              const qty = getQty(item.id);

              return (
                <div key={item.id} className={styles.menuRow}>
                  {/* LEFT */}
                  <div className={styles.menuLeft}>
                    <img
                      src={item.image ?? PLACEHOLDER_IMG}
                      className={styles.thumb}
                      alt={item.title}
                      onError={(e) => {
                        // Odoo image 404 (or broken local) → placeholder.
                        const img = e.currentTarget;
                        if (img.src.indexOf(PLACEHOLDER_IMG) === -1) {
                          img.src = PLACEHOLDER_IMG;
                        }
                      }}
                    />
                    <div>
                      <h3>{item.title}</h3>
                      {item.description && <p>{item.description}</p>}
                      {isBananaLeafBase && (
                        <p style={{ fontSize: 12, color: "#FFD042", marginTop: 2, fontWeight: 600 }}>
                          🌶️ Add a protein from “Add On (Extra)” below
                        </p>
                      )}
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div className={styles.menuRight}>
                    {typeof item.price === "number" && (
                      <div className={styles.menuPrice}>
                        ${item.price.toFixed(2)}
                      </div>
                    )}

                    {isBanana && (
                      weekendAvailable && canOrder ? (
                        <button
                          className={styles.addBtn}
                          onClick={() => {
                            setBananaBase(item);
                            setBlOpen(true);
                          }}
                        >
                          Customize
                        </button>
                      ) : isWeekendOnly && !weekendAvailable ? (
                        <div style={{
                          fontSize: 11, color: "#FFD042", fontWeight: 600,
                          textAlign: "center", opacity: 0.85, marginTop: 4,
                        }}>
                          🗓️ Weekend only
                        </div>
                      ) : null
                    )}

                    {!isBanana && hasOptions && canOrder && (
                      needsBananaLeaf ? (
                        !weekendAvailable ? (
                          <div style={{ fontSize: 11, color: "#FFD042", fontWeight: 600, textAlign: "center", opacity: 0.85, marginTop: 4 }}>
                            🗓️ Weekend only
                          </div>
                        ) : !bananaInCart ? (
                          <div style={{ fontSize: 11, color: "#FFD042", fontWeight: 600, textAlign: "center", opacity: 0.85, marginTop: 4 }}>
                            🍃 Add Banana Leaf Set first
                          </div>
                        ) : (
                          <button
                            className={styles.addBtn}
                            onClick={() => { setSelectedItem(item); setVariantOpen(true); }}
                          >
                            Options
                          </button>
                        )
                      ) : (
                        !weekendAvailable ? (
                          <div style={{ fontSize: 11, color: "#FFD042", fontWeight: 600, textAlign: "center", opacity: 0.85, marginTop: 4 }}>
                            🗓️ Weekend only
                          </div>
                        ) : (
                          <button
                            className={styles.addBtn}
                            onClick={() => { setSelectedItem(item); setVariantOpen(true); }}
                          >
                            Options
                          </button>
                        )
                      )
                    )}

                    {!VIEW_ONLY_MENU && !isBanana && !hasOptions && canOrder && (
                      !weekendAvailable ? (
                        <div style={{ fontSize: 11, color: "#FFD042", fontWeight: 600, textAlign: "center", opacity: 0.85, marginTop: 4 }}>
                          🗓️ Weekend only
                        </div>
                      ) : (
                      <div className={styles.qtyWrap}>
                        {qty === 0 ? (
                          <button
                            className={styles.addBtn}
                            onClick={() =>
                              addItem({
                                id:           item.id,
                                title:        item.title,
                                price:        item.price ?? 0,
                                odooProductId: item.odooProductId,
                                qty:          1,
                              })
                            }
                          >
                            Add
                          </button>
                        ) : (
                          <>
                            <button
                              className={styles.qtyBtn}
                              onClick={() => updateQty(item.id, qty - 1)}
                            >
                              −
                            </button>
                            <span className={styles.qtyValue}>{qty}</span>
                            <button
                              className={styles.qtyBtn}
                              onClick={() => updateQty(item.id, qty + 1)}
                            >
                              +
                            </button>
                          </>
                        )}
                      </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </main>

      <BananaLeafModal
        open={blOpen}
        onClose={() => setBlOpen(false)}
        baseItem={bananaBase}
      />

      <VariantModal
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        item={selectedItem ?? undefined}
      />

      <a
        href="https://wa.me/61460316046"
        target="_blank"
        rel="noreferrer"
        className="whatsapp-float"
      >
        <img
          src="/images/whatsapp-icon.png"
          alt="WhatsApp"
          className="whatsapp-icon"
        />
      </a>

      <footer className="footer">
        <div className="footer-inner site-container">
          <div className="footer-brand">Sedap Eatery</div>
          Shop #4, 10–26 Vale Ave, Valley View, SA
          <div className="footer-info">
            Powered by{" "}
            <a
              href="https://dispatch.genzonix.com/"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              TeamCoopTech
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}