import { PlannedMeal } from "../domain/types";

export interface CartItem {
  id: string;
  meal: PlannedMeal;
  accompaniment?: string;
  quantity: number;
}

export interface AddonItem {
  slug: string;
  name: string;
  category: string;
  pricePaise: number;
  calories: number;
}

let items: CartItem[] = [];

const DEFAULT_ADDONS: AddonItem[] = [
  {
    slug: "digestive-kombucha",
    name: "Digestive Botanical Kombucha",
    category: "beverage",
    pricePaise: 12000,
    calories: 35,
  },
  {
    slug: "roasted-makhana",
    name: "Herbed Superfood Makhana",
    category: "snack",
    pricePaise: 8000,
    calories: 110,
  },
  {
    slug: "cold-pressed-amla",
    name: "Cold-Pressed Amla Immunity Shot",
    category: "beverage",
    pricePaise: 6000,
    calories: 20,
  },
];

export const CartService = {
  clear(): void {
    items = [];
  },

  getItems(): CartItem[] {
    return [...items];
  },

  addItem(meal: PlannedMeal, accompaniment?: string): CartItem {
    const item: CartItem = {
      id: `cart_${Date.now()}_${items.length}`,
      meal,
      accompaniment,
      quantity: 1,
    };
    items.push(item);
    return item;
  },

  removeItem(id: string): void {
    items = items.filter((i) => i.id !== id);
  },

  getSubtotalPaise(): number {
    return items.reduce((sum, item) => sum + item.meal.pricePaise * item.quantity, 0);
  },

  getRecommendedAddons(): AddonItem[] {
    return DEFAULT_ADDONS;
  },
};
