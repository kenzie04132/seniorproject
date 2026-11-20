// ---------- Smart shopping list logic (Week 10) ----------
//
// Plain logic with no internet or database calls, so it is easy to unit test in Week 11.
//
// What makes the list "smart":
//   1. Open a recipe and tap one button: every ingredient you don't have goes on the list.
//      Salt, pepper and water are skipped (same rule as the Week 9 matching).
//   2. No duplicates. If two recipes both need onions, "onion" is on the list once,
//      with both amounts ("2 + 1 chopped") and both recipe names under it.
//      Tapping the button twice for the same recipe doesn't add anything again.
//   3. Each item gets a store section (Produce, Dairy, Meat...) guessed from its name,
//      so the list is grouped the way you walk through a store.
//   4. When you're done shopping, checked items move into the pantry in one tap.

import { Category, ShoppingListItem } from "@/types/models";
import { pantryHas, simplifyName, STAPLES } from "./matching";

export type RecipeIngredient = { name: string; measure: string }; // e.g. { name: "Onion", measure: "2 chopped" }

// The recipe ingredients you'd need to buy: not in the pantry, not a staple, no repeats.
export function missingForRecipe(ingredients: RecipeIngredient[], pantryNames: string[]): RecipeIngredient[] {
  const seen = new Set<string>();
  const missing: RecipeIngredient[] = [];
  for (const ing of ingredients) {
    const key = listKey(ing.name);
    if (STAPLES.has(key) || seen.has(key) || pantryHas(ing.name, pantryNames)) continue;
    seen.add(key);
    missing.push(ing);
  }
  return missing;
}

// The name used to spot duplicates: "Onions " and "onion" are the same item.
export function listKey(name: string) {
  return simplifyName(name);
}

// ---------- Planning what to write ----------

type ListRow = Pick<ShoppingListItem, "id" | "normalizedName" | "checked" | "measure" | "sourceRecipeIds">;

export type AddPlan = {
  add: RecipeIngredient[]; // brand new rows
  merge: { id: string; measure: string }[]; // rows already on the list that this recipe also needs
  alreadyAdded: number; // ingredients this same recipe already put on the list
};

// Work out what adding one recipe's missing ingredients should do to the list.
// Only unchecked rows count: if you already bought (checked) onions, a new row is added.
export function planAddToList(missing: RecipeIngredient[], recipeId: string, list: ListRow[]): AddPlan {
  const open = new Map(list.filter((row) => !row.checked).map((row) => [row.normalizedName, row]));
  const plan: AddPlan = { add: [], merge: [], alreadyAdded: 0 };
  for (const ing of missing) {
    const row = open.get(listKey(ing.name));
    if (!row) plan.add.push(ing);
    else if (row.sourceRecipeIds.includes(recipeId)) plan.alreadyAdded++;
    else plan.merge.push({ id: row.id, measure: combineMeasures(row.measure, ing.measure) });
  }
  return plan;
}

// "2 cups" + "1 tbsp" -> "2 cups + 1 tbsp". Blank amounts are skipped.
export function combineMeasures(a: string, b: string) {
  return [a.trim(), b.trim()].filter(Boolean).join(" + ");
}

// ---------- Store sections ----------

// Words that hint at a store section. A word matches the start of a word in the item,
// so "tomato" matches "Cherry Tomatoes". When several match, the longest wins,
// so "Coconut Milk" is Canned (not Dairy) and "Black Pepper" is Spices (not Produce).
const SECTION_WORDS: Record<Category, string[]> = {
  produce: [
    "onion", "garlic", "tomato", "potato", "carrot", "pepper", "lettuce", "spinach", "lemon", "lime",
    "apple", "banana", "mushroom", "celery", "ginger", "cucumber", "avocado", "parsley", "coriander",
    "cilantro", "basil", "mint", "thyme", "rosemary", "chilli", "chili", "courgette", "zucchini",
    "broccoli", "cabbage", "leek", "shallot", "spring onion", "scallion", "pea", "sweetcorn", "aubergine",
    "eggplant", "berr", "strawberr", "orange", "kale", "squash", "pumpkin", "cauliflower", "fruit",
  ],
  dairy: [
    "milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "egg", "parmesan", "mozzarella", "cheddar",
    "feta", "creme fraiche",
  ],
  meat: [
    "chicken", "beef", "pork", "lamb", "bacon", "sausage", "ham", "turkey", "mince", "steak", "fish",
    "salmon", "tuna", "prawn", "shrimp", "cod", "chorizo",
  ],
  grains: [
    "rice", "pasta", "spaghetti", "noodle", "bread", "flour", "oat", "tortilla", "couscous", "quinoa",
    "penne", "macaroni", "breadcrumb", "lasagne", "bun", "cereal", "egg noodle",
  ],
  canned: [
    "tinned", "canned", "chopped tomato", "bean", "chickpea", "lentil", "stock", "broth", "chicken stock",
    "beef stock", "vegetable stock", "coconut milk", "tomato puree", "tomato paste", "soup",
  ],
  frozen: ["frozen", "ice cream"],
  spices: [
    "salt", "black pepper", "peppercorn", "cumin", "paprika", "cinnamon", "oregano", "turmeric", "curry",
    "chilli powder", "chili powder", "nutmeg", "spice", "seasoning", "bay leaf", "bay leaves", "cardamom",
    "clove", "garam masala", "cayenne",
  ],
  beverages: ["juice", "wine", "beer", "coffee", "tea", "soda"],
  other: [
    "sugar", "honey", "oil", "olive oil", "vinegar", "sauce", "soy sauce", "ketchup", "mayonnaise",
    "mustard", "jam", "peanut butter", "chocolate", "baking powder",
  ],
};

export function guessCategory(name: string): Category {
  const text = ` ${name.toLowerCase().trim()}`;
  let best: Category = "other";
  let bestLength = 0;
  for (const [category, words] of Object.entries(SECTION_WORDS) as [Category, string[]][]) {
    for (const word of words) {
      if (word.length > bestLength && text.includes(` ${word}`)) {
        best = category;
        bestLength = word.length;
      }
    }
  }
  return best;
}

// ---------- Showing the list ----------

// The order you'd walk through a typical store
export const STORE_ORDER: Category[] = [
  "produce", "meat", "dairy", "grains", "canned", "frozen", "spices", "beverages", "other",
];

export type ListSection = { title: string; data: ShoppingListItem[] };

// Unchecked items grouped by store section (A-Z inside each),
// then everything already checked off in one "In your cart" section at the bottom.
export function groupForDisplay(items: ShoppingListItem[], sectionTitle: (c: Category) => string): ListSection[] {
  const byName = (a: ShoppingListItem, b: ShoppingListItem) => a.name.localeCompare(b.name);
  const sections: ListSection[] = STORE_ORDER.map((category) => ({
    title: sectionTitle(category),
    data: items.filter((item) => !item.checked && item.category === category).sort(byName),
  })).filter((section) => section.data.length > 0);

  const checked = items.filter((item) => item.checked).sort(byName);
  if (checked.length > 0) sections.push({ title: "In your cart", data: checked });
  return sections;
}
