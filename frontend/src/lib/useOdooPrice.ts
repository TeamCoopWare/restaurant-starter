import { useEffect, useState } from "react";

export function useOdooPrice(odooProductId?: number, fallbackPrice?: number) {
  const [price, setPrice] = useState<number | undefined>(fallbackPrice);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!odooProductId) return;

    setLoading(true);

    fetch(`http://localhost:4000/odoo/product/${odooProductId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.product?.list_price !== undefined) {
          setPrice(data.product.list_price);
        }
      })
      .catch(() => {
        setPrice(fallbackPrice);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [odooProductId]);

  return { price, loading };
}
