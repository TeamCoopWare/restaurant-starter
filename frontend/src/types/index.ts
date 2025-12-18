// src/types/index.ts
export interface MenuItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  price: number;
  image?: string;
}

export interface AddOn {
  id: string;
  title: string;
  price: number;
}

export interface CartItem {
  itemId: string;
  qty: number;
  addons?: string[];
  notes?: string;
}
