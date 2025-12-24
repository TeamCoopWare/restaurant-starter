import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { VIEW_ONLY_MENU } from "../../config/appConfig";


/* =========================
   TYPES
========================= */

export type CartItem = {
  id: string;
  title: string;
  price: number;
  qty: number;
  odooProductId?: number;
};


type State = {
  items: CartItem[];
};

type Action =
  | { type: "HYDRATE"; payload: State }
  | { type: "ADD"; payload: CartItem }
  | { type: "UPDATE_QTY"; payload: { id: string; qty: number } }
  | { type: "REMOVE"; payload: { id: string } }
  | { type: "CLEAR" };

const initialState: State = { items: [] };

/* =========================
   REDUCER
========================= */

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return action.payload;

    case "ADD": {
      const existing = state.items.find((i) => i.id === action.payload.id);

      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.payload.id
              ? { ...i, qty: i.qty + action.payload.qty }
              : i
          ),
        };
      }

      return {
        ...state,
        items: [...state.items, action.payload],
      };
    }

    case "UPDATE_QTY": {
      if (action.payload.qty <= 0) {
        return {
          ...state,
          items: state.items.filter((i) => i.id !== action.payload.id),
        };
      }

      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id
            ? { ...i, qty: action.payload.qty }
            : i
        ),
      };
    }

    case "REMOVE":
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.payload.id),
      };

    case "CLEAR":
      return { ...state, items: [] };

    default:
      return state;
  }
}

/* =========================
   CONTEXT
========================= */

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;

  /* drawer control */
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

/* =========================
   PROVIDER
========================= */

export const CartProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  /* Drawer state */
  const [isCartOpen, setIsCartOpen] = useState(false);

  /* Load cart */
  useEffect(() => {
    const raw = localStorage.getItem("sedap_cart_v2");
    if (raw) {
      dispatch({ type: "HYDRATE", payload: JSON.parse(raw) });
    }
  }, []);

  /* Persist cart */
  useEffect(() => {
    localStorage.setItem("sedap_cart_v2", JSON.stringify(state));
  }, [state]);

  /* Actions */
  const addItem = (item: CartItem) => {
    if (VIEW_ONLY_MENU) return;
    dispatch({ type: "ADD", payload: item });
    setIsCartOpen(true); // auto-open drawer
  };

  const updateQty = (id: string, qty: number) =>
    dispatch({ type: "UPDATE_QTY", payload: { id, qty } });

  const clearCart = () => dispatch({ type: "CLEAR" });

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        addItem,
        updateQty,
        clearCart,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

/* =========================
   HOOK
========================= */

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return ctx;
};
