import { arrayUnion, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { userDoc } from "./collections";

// ---------- Recipe preferences (saved on the users/{uid} profile) ----------
//
// hiddenRecipeIds: recipes the user tapped "Not interested" on. They never show again.
// preferredArea:   the region the user picked, e.g. "Mexican". Recipes from it rank higher.

export type RecipePreferences = {
  hiddenRecipeIds: string[];
  preferredArea: string | null;
};

// Live preferences: updates as soon as the user hides a recipe or picks a region
export function useRecipePreferences(uid: string | undefined) {
  const [prefs, setPrefs] = useState<RecipePreferences>({ hiddenRecipeIds: [], preferredArea: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onSnapshot(
      userDoc(uid),
      (snap) => {
        const data = snap.data();
        setPrefs({
          hiddenRecipeIds: data?.hiddenRecipeIds ?? [],
          preferredArea: data?.preferredArea ?? null,
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

export function setPreferredArea(uid: string, area: string | null) {
  return setDoc(userDoc(uid), { preferredArea: area }, { merge: true });
}

// Regions TheMealDB has recipes for: "American", "Italian", "Mexican", ...
export async function loadAreas(): Promise<string[]> {
  const response = await fetch("https://www.themealdb.com/api/json/v1/1/list.php?a=list");
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  const data = await response.json();
  const areas: string[] = (data.meals ?? [])
    .map((m: { strArea: string }) => m.strArea?.trim())
    .filter((area: string) => area && area !== "Unknown");
  return [...new Set(areas)].sort(); // Set removes duplicates (TheMealDB lists some twice)
}
