import { useOdooPrice } from "../lib/useOdooPrice";

export default function MenuPrice({
  odooProductId,
  fallbackPrice,
}: {
  odooProductId?: number;
  fallbackPrice?: number;
}) {
  const odooPrice = useOdooPrice(odooProductId);

  // 🔑 Force numeric conversion
  const price = Number(odooPrice ?? fallbackPrice);

  // If price is NaN or invalid, render nothing
  if (!Number.isFinite(price)) return null;

  return <>{price.toFixed(2)}</>;
}
