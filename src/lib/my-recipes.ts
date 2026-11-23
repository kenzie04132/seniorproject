import { addDoc, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { UserRecipe } from "@/types/models";
import { myRecipesCol } from "./collections";
import { saveChange } from "./offline";
import type { RecipeDetails } from "./recipes";

// ---------- The user's own recipes (Week 10) ----------
//
// Family recipes typed in by hand, or recipes from a website saved with their link.
// Only the user who added a recipe can see it.
//
// On the Recipes tab and recipe page these use the id "my-<Firestore id>",
// so they never get mixed up with TheMealDB ids or the built-in "easy-" meals.

const PREFIX = "my-";
export const MY_RECIPE_EMOJI = "📖";

export type NewUserRecipe = Omit<UserRecipe, "id" | "createdAt" | "updatedAt">;

export function isMyRecipe(id: string) {
  return id.startsWith(PREFIX);
}
export function toScreenId(firestoreId: string) {
  return PREFIX + firestoreId;
}
export function toFirestoreId(screenId: string) {
  return screenId.slice(PREFIX.length);
}

// Live list of the user's recipes, A-Z
export function useMyRecipes(uid: string | undefined) {
  const [recipes, setRecipes] = useState<UserRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onSnapshot(
      myRecipesCol(uid),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as UserRecipe);
        setRecipes(list.sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
      },
      () => setLoading(false) // no internet: just show no recipes of your own
    );
    return unsubscribe;
  }, [uid]);

  return { recipes, loading };
}

export async function getMyRecipe(uid: string, firestoreId: string) {
  const snap = await getDoc(doc(myRecipesCol(uid), firestoreId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as UserRecipe) : null;
}

// What the recipe page needs, in the same shape as a TheMealDB recipe
export function toRecipeDetails(recipe: UserRecipe): RecipeDetails {
  return {
    id: toScreenId(recipe.id),
    name: recipe.name,
    thumbnail: "",
    emoji: MY_RECIPE_EMOJI,
    category: "My recipe",
    area: "",
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    youtube: null,
    source: recipe.sourceUrl,
  };
}

export function addMyRecipe(uid: string, recipe: NewUserRecipe) {
  return saveChange(
    addDoc(myRecipesCol(uid), { ...recipe, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  );
}

export function updateMyRecipe(uid: string, firestoreId: string, recipe: NewUserRecipe) {
  return saveChange(updateDoc(doc(myRecipesCol(uid), firestoreId), { ...recipe, updatedAt: serverTimestamp() }));
}

export function deleteMyRecipe(uid: string, firestoreId: string) {
  return saveChange(deleteDoc(doc(myRecipesCol(uid), firestoreId)));
}

// ---------- Checking the form (plain logic, easy to unit test) ----------

// Cleans up what the user typed. Returns an error message, or the recipe ready to save.
export function checkRecipeForm(form: {
  name: string;
  link: string;
  ingredients: { name: string; measure: string }[];
  stepsText: string;
}): { error: string } | { recipe: NewUserRecipe } {
  const name = form.name.trim();
  const link = form.link.trim();
  const ingredients = form.ingredients
    .map((ing) => ({ name: ing.name.trim(), measure: ing.measure.trim() }))
    .filter((ing) => ing.name); // skip empty rows
  const steps = parseStepLines(form.stepsText);

  if (!name) return { error: "Give your recipe a name." };
  if (link && !/^https?:\/\/\S+\.\S+/i.test(link)) {
    return { error: "The link should start with https://, for example https://www.allrecipes.com/..." };
  }
  if (ingredients.length === 0) {
    return { error: "Add at least one ingredient, so SmartPantry can match it with your pantry." };
  }
  if (steps.length === 0 && !link) {
    return { error: "Add the steps, or a link to the recipe online." };
  }
  return { recipe: { name, sourceUrl: link || null, ingredients, steps } };
}

// ---------- Pasting an ingredient list ----------

// Words that are part of the amount, not the ingredient: "2 cups flour" -> "2 cups" + "flour"
const UNIT_WORDS = new Set(
  (
    "cup cups c tbsp tbsps tablespoon tablespoons tbs tsp tsps teaspoon teaspoons oz ounce ounces " +
    "lb lbs pound pounds g gram grams kg ml l liter liters litre litres pint pints quart quarts " +
    "clove cloves can cans jar jars package packages pkg packet packets stick sticks slice slices " +
    "pinch pinches dash dashes handful handfuls splash bunch bunches piece pieces large medium small whole"
  ).split(" ")
);

// A number like 2, 1.5, 1/2, ½, 1-2 or 2½
const NUMBER = /^(\d+([.,]\d+)?|\d*[½⅓⅔¼¾⅛]|\d+\/\d+|\d+-\d+)$/;

// Amounts that don't start with a number: "Pinch of salt"
const AMOUNT_ONLY = new Set(["pinch", "dash", "handful", "splash"]);

// Describe how to prepare it, not what to buy. Moved to the amount so the name matches the pantry:
// "3 very ripe bananas" -> amount "3 very ripe", name "bananas"
const PREP_WORDS = new Set(
  (
    "very ripe melted softened fresh freshly chopped diced minced sliced grated shredded beaten " +
    "peeled cooked finely roughly thinly crushed packed cold warm room-temperature unsalted salted"
  ).split(" ")
);

// Turn a pasted ingredient list (one per line, as copied from a recipe website)
// into amount + name rows. Bullets, checkboxes, "(76g)" and notes after a comma are dropped:
//   "▢ 2 cups all-purpose flour, sifted" -> { measure: "2 cups", name: "all-purpose flour" }
//   "2 to 3 very ripe bananas"           -> { measure: "2 to 3 very ripe", name: "bananas" }
//   "Pinch of salt"                      -> { measure: "Pinch", name: "salt" }
export function parseIngredientLines(text: string): { measure: string; name: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*▢□☐✓·–]+/, "").trim()) // bullets and checkboxes
    .filter((line) => line && !/^ingredients:?$/i.test(line))
    .map((line) => {
      const words = line.replace(/\([^)]*\)/g, " ").split(/\s+/).filter(Boolean); // drop "(240 ml)"
      const amount: string[] = [];
      const lower = (word: string) => word.toLowerCase().replace(/[.,]$/, "");
      while (words.length > 1) {
        const word = lower(words[0]);
        const isNumber = NUMBER.test(word);
        const isRange = amount.length > 0 && (word === "to" || word === "or") && NUMBER.test(lower(words[1]));
        const isUnit = UNIT_WORDS.has(word) && (amount.length > 0 || AMOUNT_ONLY.has(word));
        const isPrep = PREP_WORDS.has(word);
        if (!isNumber && !isRange && !isUnit && !isPrep && !AMOUNT_ONLY.has(word)) break;
        amount.push(words.shift()!);
      }
      let name = words.join(" ").split(",")[0].trim();
      name = name.replace(/^of\s+/i, "").replace(/\s+to taste$/i, ""); // "2 cups of flour", "Salt to taste"
      return { measure: amount.join(" "), name };
    })
    .filter((row) => row.name);
}

// Clean up pasted instructions, one step per line. Step numbers, "Step 1" headings,
// bullets and blank lines are removed, because the recipe page numbers the steps itself:
//   "1. Preheat the oven to 350°F." -> "Preheat the oven to 350°F."
//   "Step 2: Mash the bananas."     -> "Mash the bananas."
export function parseStepLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[•\-*▢□☐✓·–]+\s*/, "") // bullets
        .replace(/^step\s*\d+\s*[:.)-]?\s*/i, "") // "Step 1:" / "STEP 1"
        .replace(/^\d+\s*[.):-]\s*/, "") // "1." / "1)"
        .trim()
    )
    .filter((line) => line && !/^\d+$/.test(line) && !/^(instructions|directions|method):?$/i.test(line));
}
