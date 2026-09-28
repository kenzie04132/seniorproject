import { Timestamp } from "firebase/firestore";

export type Unit =
  | "count" | "g" | "kg" | "oz" | "lb"
  | "ml" | "l" | "cup" | "tbsp" | "tsp";

export type Category =
  | "produce" | "dairy" | "meat" | "grains"
  | "canned" | "frozen" | "spices" | "beverages" | "other";

// users/{uid}
export type UserProfile = {
  uid: string;
  email: string;
  displayName: string | null;
  dietaryPreferences: string[]; // e.g. ["vegetarian", "gluten-free"]
  createdAt: Timestamp;
};

// users/{uid}/pantryItems/{id}
export type PantryItem = {
  id: string;
  name: string;            // what the user sees: "Whole Milk"
  normalizedName: string;  // used for recipe matching: "milk"
  quantity: number;
  unit: Unit;
  category: Category;
  expirationDate: Timestamp | null;
  barcode: string | null;
  lowStockThreshold: number | null; // for your quantity alerts
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// users/{uid}/shoppingList/{id}
export type ShoppingListItem = {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit: Unit;
  category: Category;
  checked: boolean;
  sourceRecipeId: string | null; // which recipe added it
  createdAt: Timestamp;
};

// When creating a new document, Firestore generates the id for you
export type NewPantryItem = Omit<PantryItem, "id" | "createdAt" | "updatedAt">;
export type NewShoppingListItem = Omit<ShoppingListItem, "id" | "createdAt">;