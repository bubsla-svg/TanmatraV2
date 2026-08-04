import { PlannedMeal } from "../domain/types";

export interface CartItem {
  cartItemId: string;
  meal: PlannedMeal;
  quantity: number;
  selectedAccompaniment?: string;
  portionOption?: "standard" | "protein-plus";
}

export class CartService {
  private static items: CartItem[] = [];

  static getItems(): CartItem[] {
    return [...this.items];
  }

  static addItem(meal: PlannedMeal, accompaniment?: string): CartItem[] {
    const existingIndex = this.items.findIndex(i => i.meal.mealId === meal.mealId);
    if (existingIndex >= 0) {
      this.items[existingIndex].quantity += 1;
    } else {
      this.items.push({
        cartItemId: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        meal,
        quantity: 1,
        selectedAccompaniment: accompaniment,
        portionOption: "standard",
      });
    }
    return this.getItems();
  }

  static removeItem(cartItemId: string): CartItem[] {
    this.items = this.items.filter(i => i.cartItemId !== cartItemId);
    return this.getItems();
  }

  static clear(): void {
    this.items = [];
  }

  static getSubtotalPaise(): number {
    return this.items.reduce((sum, item) => sum + item.meal.pricePaise * item.quantity, 0);
  }

  /**
   * CompleteYourMealRail recommendations (beverages / side digestive soups)
   */
  static getRecommendedAddons(): PlannedMeal[] {
    return [
      {
        mealId: "addon_1",
        name: "Therapeutic Digestive Kombucha",
        slug: "digestive-kombucha",
        imageUrl: "https://picsum.photos/seed/kombucha/400/300",
        calories: 60,
        proteinGrams: 1,
        carbsGrams: 12,
        fatGrams: 0,
        clinicalTags: ["probiotic", "gut-health"],
        isLocked: false,
        pricePaise: 12900,
      },
      {
        mealId: "addon_2",
        name: "Anti-Inflammatory Ginger Elixir",
        slug: "ginger-elixir",
        imageUrl: "https://picsum.photos/seed/elixir/400/300",
        calories: 45,
        proteinGrams: 0,
        carbsGrams: 9,
        fatGrams: 0,
        clinicalTags: ["immunity", "anti-inflammatory"],
        isLocked: false,
        pricePaise: 9900,
      }
    ];
  }
}
