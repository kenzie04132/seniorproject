import { useEffect, useState } from "react";

import { PantryItem } from "@/types/models";
import { AREA_BONUS, byBestMatch, MatchedIngredient, RankedRecipe, scoreRecipe, toMealDbName, urgencyPoints } from "./matching";
import { daysUntil } from "./pantry";
import { RecipePreferences } from "./preferences";

export type { RankedRecipe } from "./matching";

type MealSummary = { idMeal: string; strMeal: string; strMealThumb: string };

const API = "https://www.themealdb.com/api/json/v1/1";

// Only search for this many pantry ingredients so we don't send dozens of requests at once
const MAX_INGREDIENTS = 10;

// Only look up the full ingredient list for this many of the best candidates
const MAX_RESULTS = 15;

// All recipes that use one ingredient. TheMealDB wants "chicken_breast", not "chicken breast".
export async function recipesWithIngredient(ingredient: string): Promise<MealSummary[]> {
  const query = encodeURIComponent(ingredient.trim().replace(/\s+/g, "_"));
  const response = await fetch(`${API}/filter.php?i=${query}`);
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  const data = await response.json();
  return data.meals ?? []; // TheMealDB sends meals: null when nothing matches
}

// One recipe's full ingredient list, e.g. ["Chicken Breast", "Spinach", "Garlic"]
async function recipeIngredients(id: string): Promise<string[]> {
  const response = await fetch(`${API}/lookup.php?i=${id}`);
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  const meal = (await response.json()).meals?.[0];
  if (!meal) return [];
  const list: string[] = [];
  for (let n = 1; n <= 20; n++) {
    const ingredient = meal[`strIngredient${n}`]?.trim();
    if (ingredient) list.push(ingredient);
  }
  return list;
}

// Ids of every recipe from one region, e.g. all "Mexican" recipes
async function recipeIdsFromArea(area: string): Promise<Set<string>> {
  const response = await fetch(`${API}/filter.php?a=${encodeURIComponent(area)}`);
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  const data = await response.json();
  return new Set((data.meals ?? []).map((meal: MealSummary) => meal.idMeal));
}

// Every ingredient name TheMealDB knows (about 600). Loaded once, then reused.
let knownIngredients: Promise<string[]> | null = null;
function loadKnownIngredients() {
  knownIngredients ??= fetch(`${API}/list.php?i=list`)
    .then((response) => response.json())
    .then((data) => (data.meals ?? []).map((m: { strIngredient: string }) => m.strIngredient))
    .catch(() => {
      knownIngredients = null; // try again next time
      return [];
    });
  return knownIngredients;
}

// Find recipes for the pantry and rank them so soonest-expiring food gets used first.
export async function searchRecipesForPantry(
  items: PantryItem[],
  prefs: RecipePreferences
): Promise<RankedRecipe[]> {
  const known = await loadKnownIngredients();
  // If the region list fails to load, just rank without the region bonus
  const areaIds = prefs.preferredArea
    ? await recipeIdsFromArea(prefs.preferredArea).catch(() => new Set<string>())
    : new Set<string>();
  const hidden = new Set(prefs.hiddenRecipeIds);

  // Skip expired food: we shouldn't suggest cooking with it.
  // Map each item to TheMealDB's name ("Tyson Chicken Breast" -> "chicken breast").
  // The pantry is sorted soonest-expiring first, so the first item with a name
  // tells us how soon that ingredient expires.
  const soonest = new Map<string, number | null>();
  for (const item of items) {
    const daysLeft = daysUntil(item.expirationDate);
    if (daysLeft !== null && daysLeft < 0) continue;
    const name = toMealDbName(item.name, known);
    if (!soonest.has(name)) soonest.set(name, daysLeft);
  }
  const pantryNames = [...soonest.keys()];
  const searched = pantryNames.slice(0, MAX_INGREDIENTS);
  if (searched.length === 0) return [];

  // allSettled: if one ingredient's search fails, still show recipes from the others
  const results = await Promise.allSettled(searched.map((name) => recipesWithIngredient(name)));
  if (results.every((result) => result.status === "rejected")) {
    throw new Error("Every recipe search failed");
  }

  // Combine: a recipe found for several ingredients appears once, listing all of them
  const candidates = new Map<string, { meal: MealSummary; matched: MatchedIngredient[] }>();
  results.forEach((result, i) => {
    if (result.status === "rejected") return;
    for (const meal of result.value) {
      if (hidden.has(meal.idMeal)) continue; // user said "Not interested"
      const entry = candidates.get(meal.idMeal) ?? { meal, matched: [] };
      entry.matched.push({ name: searched[i], daysLeft: soonest.get(searched[i]) ?? null });
      candidates.set(meal.idMeal, entry);
    }
  });

  // First pass: keep the candidates with the most urgency points (plus the region bonus),
  // so we only look up full details for the best few
  const quickScore = ({ meal, matched }: { meal: MealSummary; matched: MatchedIngredient[] }) =>
    matched.reduce((sum, ing) => sum + urgencyPoints(ing.daysLeft), 0) + (areaIds.has(meal.idMeal) ? AREA_BONUS : 0);
  const shortlist = [...candidates.values()]
    .sort((a, b) => quickScore(b) - quickScore(a) || b.matched.length - a.matched.length)
    .slice(0, MAX_RESULTS);

  // Second pass: get each recipe's full ingredient list and score it
  const ranked = await Promise.all(
    shortlist.map(async ({ meal, matched }) => {
      // If the details don't load, still score it using only what we matched
      const ingredients = await recipeIngredients(meal.idMeal).catch(() => matched.map((m) => m.name));
      return scoreRecipe(
        { id: meal.idMeal, name: meal.strMeal, thumbnail: meal.strMealThumb },
        matched,
        ingredients,
        pantryNames,
        areaIds.has(meal.idMeal)
      );
    })
  );
  return ranked.sort(byBestMatch);
}

// Re-runs the search whenever the pantry changes
export function useRecipeMatches(items: PantryItem[], prefs: RecipePreferences, waiting: boolean) {
  const [recipes, setRecipes] = useState<RankedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search again when names or expiration dates change, not on every quantity edit
  // or when the user hides a recipe or picks a region
  const key =
    items.map((item) => `${item.name}@${item.expirationDate?.toMillis() ?? ""}`).join("|") +
    `#${prefs.preferredArea}#${prefs.hiddenRecipeIds.join(",")}`;

  useEffect(() => {
    if (waiting) return;
    let cancelled = false;
    setLoading(true);
    searchRecipesForPantry(items, prefs)
      .then((list) => {
        if (cancelled) return;
        setRecipes(list);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load recipes. Check your internet connection.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, waiting]);

  return { recipes, loading, error };
}
