import { useEffect, useState } from "react";

import { PantryItem } from "@/types/models";
import { byBestMatch, MatchedIngredient, RankedRecipe, scoreRecipe, toMealDbName, urgencyPoints } from "./matching";
import { daysUntil } from "./pantry";
import { RecipePreferences } from "./preferences";
import { isSimpleMeal, simpleMealDetails } from "./simple-meals";

export type { RankedRecipe } from "./matching";

type MealSummary = { idMeal: string; strMeal: string; strMealThumb: string };

const API = "https://www.themealdb.com/api/json/v1/1";

// Only search for this many pantry ingredients so we don't send dozens of requests at once
const MAX_INGREDIENTS = 10;

// Only look up the full recipe for this many of the best candidates
// (enough that filtering for Easy recipes still leaves a good list)
const MAX_RESULTS = 25;

// All recipes that use one ingredient. TheMealDB wants "chicken_breast", not "chicken breast".
export async function recipesWithIngredient(ingredient: string): Promise<MealSummary[]> {
  const query = encodeURIComponent(ingredient.trim().replace(/\s+/g, "_"));
  const response = await fetch(`${API}/filter.php?i=${query}`);
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  const data = await response.json();
  return data.meals ?? []; // TheMealDB sends meals: null when nothing matches
}

export type RecipeDetails = {
  id: string;
  name: string;
  thumbnail: string;
  category: string; // e.g. "Chicken"
  area: string; // e.g. "Italian"
  ingredients: { name: string; measure: string }[]; // e.g. { name: "Rice", measure: "2 cups" }
  steps: string[]; // the instructions, one paragraph per step
  youtube: string | null;
  source: string | null; // the website the recipe came from
  emoji?: string; // super easy meals have an emoji instead of a photo
};

// Everything about one recipe, for the recipe page
export async function getRecipeDetails(id: string): Promise<RecipeDetails | null> {
  if (isSimpleMeal(id)) return simpleMealDetails(id); // built into the app, no internet needed
  const response = await fetch(`${API}/lookup.php?i=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  const meal = (await response.json()).meals?.[0];
  if (!meal) return null;

  // TheMealDB stores ingredients as strIngredient1..20 and strMeasure1..20
  const ingredients: RecipeDetails["ingredients"] = [];
  for (let n = 1; n <= 20; n++) {
    const name = meal[`strIngredient${n}`]?.trim();
    if (name) ingredients.push({ name, measure: meal[`strMeasure${n}`]?.trim() ?? "" });
  }

  // Split the instructions into paragraphs and drop "STEP 1" style labels
  const steps = (meal.strInstructions ?? "")
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line && !/^step\s*\d+$/i.test(line));

  return {
    id: meal.idMeal,
    name: meal.strMeal,
    thumbnail: meal.strMealThumb,
    category: meal.strCategory ?? "",
    area: meal.strArea ?? "",
    ingredients,
    steps,
    youtube: meal.strYoutube || null,
    source: meal.strSource || null,
  };
}

// How many full recipes to look up at the same time
const LOOKUPS_AT_ONCE = 5;

// Full recipes we've already loaded, so searching again doesn't ask TheMealDB twice
const detailsCache = new Map<string, RecipeDetails>();

// Look up a recipe; if it fails, wait a second and try once more. null if both fail.
async function detailsWithRetry(id: string): Promise<RecipeDetails | null> {
  const cached = detailsCache.get(id);
  if (cached) return cached;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const details = await getRecipeDetails(id);
      if (details) detailsCache.set(id, details);
      return details;
    } catch {
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return null;
}

// Ids of every recipe from one region, e.g. all "Mexican" recipes
async function recipeIdsFromArea(area: string): Promise<string[]> {
  const response = await fetch(`${API}/filter.php?a=${encodeURIComponent(area)}`);
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  const data = await response.json();
  return (data.meals ?? []).map((meal: MealSummary) => meal.idMeal);
}

// Which region each recipe is from, for the regions the user picked: recipe id -> "Mexican".
// If one region fails to load, just skip it.
async function recipeAreas(areas: string[]): Promise<Map<string, string>> {
  const results = await Promise.allSettled(areas.map((area) => recipeIdsFromArea(area)));
  const map = new Map<string, string>();
  results.forEach((result, i) => {
    if (result.status === "fulfilled") result.value.forEach((id) => map.set(id, areas[i]));
  });
  return map;
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
// The pantry's usable (not expired) food as TheMealDB names, each with how soon it expires.
// "Tyson Chicken Breast" -> "chicken breast". The pantry is sorted soonest-expiring first,
// so the first item with a name tells us how soon that ingredient expires.
export async function usablePantryIngredients(items: PantryItem[]) {
  const known = await loadKnownIngredients();
  const soonest = new Map<string, number | null>();
  for (const item of items) {
    const daysLeft = daysUntil(item.expirationDate);
    if (daysLeft !== null && daysLeft < 0) continue; // skip expired food
    const name = toMealDbName(item.name, known);
    if (!soonest.has(name)) soonest.set(name, daysLeft);
  }
  return soonest;
}

export async function searchRecipesForPantry(
  items: PantryItem[],
  prefs: RecipePreferences
): Promise<RankedRecipe[]> {
  const areaOf = await recipeAreas(prefs.preferredAreas);
  const hidden = new Set(prefs.hiddenRecipeIds);

  const soonest = await usablePantryIngredients(items);
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

  // First pass: keep the best few candidates, so we only look up full details for those.
  // Recipes from the user's region go first, then the ones with the most urgency points.
  const urgency = (matched: MatchedIngredient[]) =>
    matched.reduce((sum, ing) => sum + urgencyPoints(ing.daysLeft), 0);
  const inArea = (meal: MealSummary) => Number(areaOf.has(meal.idMeal));
  const shortlist = [...candidates.values()]
    .sort(
      (a, b) =>
        inArea(b.meal) - inArea(a.meal) ||
        urgency(b.matched) - urgency(a.matched) ||
        b.matched.length - a.matched.length
    )
    .slice(0, MAX_RESULTS);

  // Second pass: get each full recipe and score it.
  // A few at a time, because TheMealDB starts refusing if we ask for 25 at once.
  const ranked: RankedRecipe[] = [];
  for (let i = 0; i < shortlist.length; i += LOOKUPS_AT_ONCE) {
    const batch = shortlist.slice(i, i + LOOKUPS_AT_ONCE);
    const scored = await Promise.all(
      batch.map(async ({ meal, matched }) => {
        const details = await detailsWithRetry(meal.idMeal);
        // If the details still don't load, score it using only what we matched,
        // and mark it so the app doesn't claim "you have all the ingredients"
        const ingredients = details ? details.ingredients.map((ing) => ing.name) : matched.map((m) => m.name);
        const instructionWords = details ? details.steps.join(" ").split(/\s+/).length : 0;
        return scoreRecipe(
          { id: meal.idMeal, name: meal.strMeal, thumbnail: meal.strMealThumb },
          matched,
          ingredients,
          pantryNames,
          areaOf.get(meal.idMeal) ?? null,
          instructionWords,
          !!details
        );
      })
    );
    ranked.push(...scored);
  }
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
    `#${prefs.preferredAreas.join(",")}#${prefs.hiddenRecipeIds.join(",")}`;

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
