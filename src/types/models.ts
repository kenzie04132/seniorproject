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
  hiddenRecipeIds?: string[];    // recipes marked "Not interested" (Week 9)
  preferredAreas?: string[];     // regions picked on the Recipes tab, e.g. ["Mexican"] (Week 9)
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
  measure: string;               // how much the recipes ask for, e.g. "2 cups + 1 tbsp" (Week 10)
  sourceRecipeIds: string[];     // which recipes added it (empty if typed in by hand)
  sourceRecipeNames: string[];   // e.g. ["Chicken Fajitas"], shown under the item
  createdAt: Timestamp;
};

// users/{uid}/myRecipes/{id} - recipes the user added themselves (Week 10)
export type UserRecipe = {
  id: string;
  name: string;                                   // "Grandma's Chili"
  sourceUrl: string | null;                       // link to the recipe online, if it came from a website
  ingredients: { name: string; measure: string }[]; // { name: "Ground Beef", measure: "1 lb" }
  steps: string[];                                // one instruction per line (can be empty if there's a link)
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// When creating a new document, Firestore generates the id for you
export type NewPantryItem = Omit<PantryItem, "id" | "createdAt" | "updatedAt">;
export type NewShoppingListItem = Omit<ShoppingListItem, "id" | "createdAt">;