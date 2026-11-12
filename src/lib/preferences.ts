import { arrayRemove, arrayUnion, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { userDoc } from "./collections";

// ---------- Recipe preferences (saved on the users/{uid} profile) ----------
//
// hiddenRecipeIds: recipes the user tapped "Not interested" on. They never show again.
// preferredAreas:  regions the user picked, e.g. ["Mexican", "Italian"]. Recipes from them come first.

export type RecipePreferences = {
  hiddenRecipeIds: string[];
  preferredAreas: string[];
};

// Live preferences: updates as soon as the user hides a recipe or picks a region
export function useRecipePreferences(uid: string | undefined) {
  const [prefs, setPrefs] = useState<RecipePreferences>({ hiddenRecipeIds: [], preferredAreas: [] });
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
  const response = await fetch("https://www.themealdb.com/api/json/v1/1/list.php?a=list");
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  const data = await response.json();
  const areas = new Set<string>( // a Set removes duplicates (TheMealDB lists some twice)
    (data.meals ?? [])
      .map((m: { strArea: string }) => m.strArea?.trim())
      .filter((area: string) => area && area !== "Unknown")
  );
  const popular = POPULAR_AREAS.filter((area) => areas.has(area));
  const others = [...areas].filter((area) => !POPULAR_AREAS.includes(area)).sort();
  return { popular, others };
}
