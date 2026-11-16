import { addDoc, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { UserRecipe } from "@/types/models";
import { myRecipesCol } from "./collections";
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
  return addDoc(myRecipesCol(uid), { ...recipe, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export function updateMyRecipe(uid: string, firestoreId: string, recipe: NewUserRecipe) {
  return updateDoc(doc(myRecipesCol(uid), firestoreId), { ...recipe, updatedAt: serverTimestamp() });
}

export function deleteMyRecipe(uid: string, firestoreId: string) {
  return deleteDoc(doc(myRecipesCol(uid), firestoreId));
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
  const steps = form.stepsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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
