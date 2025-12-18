// frontend/src/pages/_app.tsx

import type { AppProps } from "next/app";
import { CartProvider } from "../lib/cartContext";
import CartDrawer from "../components/CartDrawer";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CartProvider>
      <Component {...pageProps} /> 
       <CartDrawer />
    </CartProvider>
  );
}
