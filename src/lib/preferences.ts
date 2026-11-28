import { arrayRemove, arrayUnion, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { userDoc } from "./collections";
import { Diet } from "./dietary";
import { cachedJson } from "./offline";

// ---------- Recipe preferences (saved on the users/{uid} profile) ----------
//
// hiddenRecipeIds: recipes the user tapped "Not interested" on. They never show again.
// preferredAreas:  regions the user picked, e.g. ["Mexican", "Italian"]. Recipes from them come first.
// dietaryPreferences: diets the user picked, e.g. ["vegetarian"]. Only recipes that fit are shown (Week 11).

export type RecipePreferences = {
  hiddenRecipeIds: string[];
  preferredAreas: string[];
  dietaryPreferences: Diet[];
};

// Live preferences: updates as soon as the user hides a recipe or picks a region
export function useRecipePreferences(uid: string | undefined) {
  const [prefs, setPrefs] = useState<RecipePreferences>({
    hiddenRecipeIds: [],
    preferredAreas: [],
    dietaryPreferences: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onSnapshot(
      userDoc(uid),
      (snap) => {
        const data = snap.data();
        setPrefs({
          hiddenRecipeIds: data?.hiddenRecipeIds ?? [],
          preferredAreas: data?.preferredAreas ?? [],
          dietaryPreferences: data?.dietaryPreferences ?? [],
        });
        setLoading(false);
      },
      () => setLoading(false) // if it fails, just show recipes without preferences
    );
    return unsubscribe;
  }, [uid]);

  return { prefs, loading };
}

// merge: true only changes these fields and leaves the rest of the profile alone
export function hideRecipe(uid: string, recipeId: string) {
  return setDoc(userDoc(uid), { hiddenRecipeIds: arrayUnion(recipeId) }, { merge: true });
}

export function showHiddenRecipes(uid: string) {
  return setDoc(userDoc(uid), { hiddenRecipeIds: [] }, { merge: true });
}

// Tick or untick one region
export function togglePreferredArea(uid: string, area: string, selected: boolean) {
  return setDoc(
    userDoc(uid),
    { preferredAreas: selected ? arrayUnion(area) : arrayRemove(area) },
    { merge: true }
  );
}

// Tick or untick one diet, e.g. "vegan"
export function toggleDiet(uid: string, diet: Diet, selected: boolean) {
  return setDoc(
    userDoc(uid),
    { dietaryPreferences: selected ? arrayUnion(diet) : arrayRemove(diet) },
    { merge: true }
  );
}

export function clearPreferredAreas(uid: string) {
  return setDoc(userDoc(uid), { preferredAreas: [] }, { merge: true });
}

// Shown at the top of the region list, in this order (if TheMealDB has them)
export const POPULAR_AREAS = [
  "American", "Mexican", "Italian", "Chinese", "Japanese", "Indian",
  "Thai", "French", "Greek", "Spanish", "British",
];

// Regions TheMealDB has recipes for, split into popular ones and the rest (A-Z)
export async function loadAreas(): Promise<{ popular: string[]; others: string[] }> {
  const data = await cachedJson("https://www.themealdb.com/api/json/v1/1/list.php?a=list");
  const areas = new Set<string>( // a Set removes duplicates (TheMealDB lists some twice)
    (data.meals ?? [])
      .map((m: { strArea: string }) => m.strArea?.trim())
      .filter((area: string) => area && area !== "Unknown")
  );
  const popular = POPULAR_AREAS.filter((area) => areas.has(area));
  const others = [...areas].filter((area) => !POPULAR_AREAS.includes(area)).sort();
  return { popular, others };
}
