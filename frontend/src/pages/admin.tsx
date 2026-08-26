/* =====================================================
   /admin — the owner's menu switchboard.

   Turn an item off when it runs out and it disappears from the customer menu
   straight away; turn it back on when it's available again. Nothing here
   touches Odoo or the POS — the on/off list lives in the website's own API.

   Auth is a single shared password (ADMIN_KEY on the backend), kept in
   localStorage so it doesn't need retyping. The page is publicly reachable but
   useless without the password, and every request is verified server-side.
========================================================= */
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { API_URL } from "../lib/api";

const KEY_STORAGE = "sedap_admin_key";

interface Variant { product_id: number; variant: string; price: number }
interface Group { name: string; variants: Variant[] }

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Restore a previously entered password.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      if (saved) setKey(saved);
    } catch {
      /* private mode — just ask again */
    }
  }, []);

  // Load the full menu (hidden items included) whenever we have a password.
  useEffect(() => {
    if (!key) return;
    setLoading(true);
    setError("");
    fetch(`${API_URL}/api/admin/menu`, { headers: { "X-Admin-Key": key } })
      .then(async (r) => {
        if (r.status === 401) throw new Error("Wrong password");
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `Error ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        setGroups(data.groups ?? []);
        setHidden(new Set((data.hidden ?? []).map(Number)));
        try { localStorage.setItem(KEY_STORAGE, key); } catch {}
      })
      .catch((e) => {
        setError(e.message);
        setKey(""); // bad password → back to the prompt
        try { localStorage.removeItem(KEY_STORAGE); } catch {}
      })
      .finally(() => setLoading(false));
  }, [key]);

  async function toggle(productId: number, hide: boolean) {
    setSaving(productId);
    setError("");
    // Optimistic: flip immediately, roll back if the server disagrees.
    const previous = new Set(hidden);
    const next = new Set(hidden);
    if (hide) next.add(productId);
    else next.delete(productId);
    setHidden(next);
    try {
      const r = await fetch(`${API_URL}/api/admin/hidden`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": key },
        body: JSON.stringify({ product_id: productId, hidden: hide }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `Error ${r.status}`);
      }
      const data = await r.json();
      setHidden(new Set((data.hidden ?? []).map(Number))); // trust the server
    } catch (e: any) {
      setHidden(previous);
      setError(e.message || "Could not save — check your connection and try again");
    } finally {
      setSaving(null);
    }
  }

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.variants.some((v) => (v.variant ?? "").toLowerCase().includes(q))
    );
  }, [groups, search]);

  const hiddenCount = hidden.size;

  /* ---------- password prompt ---------- */
  if (!key) {
    return (
      <Shell>
        <h1 style={S.h1}>Menu admin</h1>
        <p style={S.sub}>Enter the admin password to show or hide menu items.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (keyInput.trim()) setKey(keyInput.trim());
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}
        >
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Admin password"
            autoFocus
            style={S.input}
          />
          <button type="submit" style={S.primaryBtn}>Sign in</button>
        </form>
        {error && <p style={S.error}>{error}</p>}
      </Shell>
    );
  }

  /* ---------- switchboard ---------- */
  return (
    <Shell>
      <div style={S.headerRow}>
        <div>
          <h1 style={S.h1}>Menu admin</h1>
          <p style={S.sub}>
            {hiddenCount === 0
              ? "Everything is showing on the website."
              : `${hiddenCount} item${hiddenCount === 1 ? "" : "s"} hidden from the website.`}
          </p>
        </div>
        <button
          onClick={() => {
            setKey("");
            try { localStorage.removeItem(KEY_STORAGE); } catch {}
          }}
          style={S.ghostBtn}
        >
          Sign out
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search for an item..."
        style={{ ...S.input, width: "100%", maxWidth: 420, marginBottom: 18 }}
      />

      {error && <p style={S.error}>{error}</p>}
      {loading && <p style={S.sub}>Loading menu...</p>}

      {!loading && visibleGroups.length === 0 && (
        <p style={S.sub}>No items match that search.</p>
      )}

      {visibleGroups.map((g) => {
        const multi = g.variants.length > 1;
        return (
          <div key={g.name} style={S.card}>
            <div style={S.cardHead}>
              <strong style={{ fontSize: 16 }}>{g.name.trim()}</strong>
              {multi && <span style={S.badge}>{g.variants.length} options</span>}
            </div>
            {g.variants.map((v) => {
              const isHidden = hidden.has(v.product_id);
              const busy = saving === v.product_id;
              return (
                <div key={v.product_id} style={S.row}>
                  <span style={{ opacity: isHidden ? 0.5 : 1 }}>
                    {multi ? v.variant : "Price"}{" "}
                    <span style={{ color: "#FFD042", fontWeight: 600 }}>
                      ${Number(v.price).toFixed(2)}
                    </span>
                  </span>
                  <button
                    onClick={() => toggle(v.product_id, !isHidden)}
                    disabled={busy}
                    style={isHidden ? S.offBtn : S.onBtn}
                  >
                    {busy ? "Saving..." : isHidden ? "Hidden - tap to show" : "Showing - tap to hide"}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </Shell>
  );
}

/* ---------- tiny presentational helpers (kept local to this page) ---------- */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Head>
        <title>Menu admin - Sedap Eatery</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main style={S.page}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div>
      </main>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", background: "#5C2018", color: "#fff",
    padding: "32px 20px 64px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  h1: { fontSize: 28, margin: 0, color: "#FFD042" },
  sub: { margin: "6px 0 0", opacity: 0.85, fontSize: 14 },
  headerRow: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    gap: 12, flexWrap: "wrap", marginBottom: 20,
  },
  input: {
    padding: "11px 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,.25)",
    background: "rgba(0,0,0,.25)", color: "#fff", fontSize: 15, minWidth: 220,
  },
  primaryBtn: {
    padding: "11px 20px", borderRadius: 8, border: "none", background: "#FFD042",
    color: "#5C2018", fontWeight: 700, fontSize: 15, cursor: "pointer",
  },
  ghostBtn: {
    padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
    background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.35)",
  },
  card: {
    background: "rgba(0,0,0,.18)", borderRadius: 10, padding: "14px 16px", marginBottom: 12,
  },
  cardHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  badge: {
    fontSize: 11, opacity: 0.75, border: "1px solid rgba(255,255,255,.3)",
    borderRadius: 999, padding: "1px 8px",
  },
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 12, padding: "6px 0", flexWrap: "wrap", fontSize: 14,
  },
  onBtn: {
    padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(120,255,150,.5)",
    background: "rgba(60,200,100,.18)", color: "#b6ffc9", fontSize: 13,
    fontWeight: 600, cursor: "pointer",
  },
  offBtn: {
    padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(255,120,120,.5)",
    background: "rgba(200,60,60,.22)", color: "#ffc9c9", fontSize: 13,
    fontWeight: 600, cursor: "pointer",
  },
  error: {
    marginTop: 14, padding: "10px 12px", borderRadius: 8, fontSize: 14,
    background: "rgba(200,60,60,.25)", border: "1px solid rgba(255,120,120,.5)",
  },
};
