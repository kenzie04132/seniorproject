import { useEffect, useState } from "react";

import { PantryItem } from "@/types/models";

export type RecipeMatch = {
  id: string;
  name: string;
  thumbnail: string;
  matchedIngredients: string[]; // pantry items this recipe uses, e.g. ["chicken breast", "milk"]
};

type MealSummary = { idMeal: string; strMeal: string; strMealThumb: string };

const API = "https://www.themealdb.com/api/json/v1/1";

// Only search for this many pantry items so we don't send dozens of requests at once
const MAX_INGREDIENTS = 10;

// All recipes that use one ingredient. TheMealDB wants "chicken_breast", not "chicken breast".
export async function recipesWithIngredient(ingredient: string): Promise<MealSummary[]> {
  const query = encodeURIComponent(ingredient.trim().replace(/\s+/g, "_"));
  const response = await fetch(`${API}/filter.php?i=${query}`);
  const data = await response.json();
  return data.meals ?? []; // TheMealDB sends meals: null when nothing matches
}

// Search TheMealDB for every pantry ingredient and combine the results.
// A recipe found for several ingredients appears once, listing all of them.
export async function searchRecipesForPantry(items: PantryItem[]): Promise<RecipeMatch[]> {
  // The pantry list is already soonest-expiring first, so those get searched first
  const ingredients = [...new Set(items.map((item) => item.normalizedName))].slice(0, MAX_INGREDIENTS);

  const results = await Promise.all(ingredients.map((ingredient) => recipesWithIngredient(ingredient)));

  const matches = new Map<string, RecipeMatch>();
  results.forEach((meals, i) => {
    for (const meal of meals) {
      const match = matches.get(meal.idMeal) ?? {
        id: meal.idMeal,
        name: meal.strMeal,
        thumbnail: meal.strMealThumb,
        matchedIngredients: [],
      };
      match.matchedIngredients.push(ingredients[i]);
      matches.set(meal.idMeal, match);
    }
  });

  // For now, recipes that use more of your pantry come first.
  // Week 9 replaces this with the expiring-first ranking.
  return [...matches.values()].sort(
    (a, b) => b.matchedIngredients.length - a.matchedIngredients.length || a.name.localeCompare(b.name)
  );
}

// Re-runs the search whenever the pantry changes
export function useRecipeMatches(items: PantryItem[], pantryLoading: boolean) {
  const [recipes, setRecipes] = useState<RecipeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Only search again when the ingredient names change, not on every quantity edit
  const key = items.map((item) => item.normalizedName).join("|");

  useEffect(() => {
    if (pantryLoading) return;
    let cancelled = false;
    setLoading(true);
    searchRecipesForPantry(items)
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
  }, [key, pantryLoading]);

  return { recipes, loading, error };
}
