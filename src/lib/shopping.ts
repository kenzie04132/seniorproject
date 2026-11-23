import {
  arrayUnion,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { ShoppingListItem } from "@/types/models";
import { pantryCol, shoppingCol } from "./collections";
import { db } from "./firebase";
import { saveChange } from "./offline";
import { guessCategory, listKey, planAddToList, RecipeIngredient } from "./shopping-logic";

// ---------- Reading the list ----------

// Live shopping list. Firestore calls us again every time an item changes.
export function useShoppingList(uid: string | undefined) {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onSnapshot(
      shoppingCol(uid),
      (snapshot) => {
        setItems(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ShoppingListItem));
        setError("");
        setLoading(false);
      },
      () => {
        setError("Couldn't load your shopping list. Check your internet connection.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  return { items, loading, error };
}

// ---------- Adding ----------

// A new list row. Recipe ingredients start as "1 count" because recipes
// use amounts like "2 cups" that don't fit a single number; the amount is kept in `measure`.
function newRow(name: string, measure: string, recipe: { id: string; name: string } | null) {
  return {
    name: name.trim(),
    normalizedName: listKey(name),
    quantity: 1,
    unit: "count",
    category: guessCategory(name),
    checked: false,
    measure: measure.trim(),
    sourceRecipeIds: recipe ? [recipe.id] : [],
    sourceRecipeNames: recipe ? [recipe.name] : [],
    createdAt: serverTimestamp(),
  };
}

// Add every missing ingredient from one recipe, without making duplicates.
// Returns how many new rows were added and how many existing rows were updated.
export async function addMissingToList(
  uid: string,
  recipe: { id: string; name: string },
  missing: RecipeIngredient[],
  currentList: ShoppingListItem[]
) {
  const plan = planAddToList(missing, recipe.id, currentList);
  if (plan.add.length === 0 && plan.merge.length === 0) return { added: 0, merged: 0 };

  // One batch = everything is saved together, or nothing is
  const batch = writeBatch(db);
  for (const ing of plan.add) {
    batch.set(doc(shoppingCol(uid)), newRow(ing.name, ing.measure, recipe));
  }
  for (const row of plan.merge) {
    batch.update(doc(shoppingCol(uid), row.id), {
      measure: row.measure,
      sourceRecipeIds: arrayUnion(recipe.id),
      sourceRecipeNames: arrayUnion(recipe.name),
    });
  }
  await saveChange(batch.commit()); // offline: saved on the device, syncs later
  return { added: plan.add.length, merged: plan.merge.length };
}

// Add one item the user typed in. Returns false if it's already on the list (and not checked off).
export async function addItemByName(uid: string, name: string, currentList: ShoppingListItem[]) {
  const key = listKey(name);
  if (currentList.some((item) => !item.checked && item.normalizedName === key)) return false;
  const batch = writeBatch(db);
  batch.set(doc(shoppingCol(uid)), newRow(name, "", null));
  await saveChange(batch.commit()); // offline: saved on the device, syncs later
  return true;
}

// ---------- Changing and removing ----------

export function setChecked(uid: string, id: string, checked: boolean) {
  return saveChange(updateDoc(doc(shoppingCol(uid), id), { checked }));
}

export function deleteShoppingItem(uid: string, id: string) {
  return saveChange(deleteDoc(doc(shoppingCol(uid), id)));
}

// Remove every checked item from the list
export async function clearChecked(uid: string, items: ShoppingListItem[]) {
  const batch = writeBatch(db);
  items.filter((item) => item.checked).forEach((item) => batch.delete(doc(shoppingCol(uid), item.id)));
  await saveChange(batch.commit()); // offline: saved on the device, syncs later
}

// Remove everything from the list
export async function clearAll(uid: string, items: ShoppingListItem[]) {
  const batch = writeBatch(db);
  items.forEach((item) => batch.delete(doc(shoppingCol(uid), item.id)));
  await saveChange(batch.commit()); // offline: saved on the device, syncs later
}

// Done shopping: put every checked item into the pantry and take it off the list.
// They go in as "1 count" with no expiration date. Returns the new pantry items,
// so the screen can offer to add their expiration dates right away.
export async function moveCheckedToPantry(uid: string, items: ShoppingListItem[]) {
  const checked = items.filter((item) => item.checked);
  const moved: { id: string; name: string }[] = [];
  const batch = writeBatch(db);
  for (const item of checked) {
    const pantryRef = doc(pantryCol(uid)); // Firestore makes the new id here
    moved.push({ id: pantryRef.id, name: item.name });
    batch.set(pantryRef, {
      name: item.name,
      normalizedName: item.name.trim().toLowerCase(), // same rule as the pantry form
      quantity: 1,
      unit: "count",
      category: item.category,
      expirationDate: null,
      barcode: null,
      lowStockThreshold: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.delete(doc(shoppingCol(uid), item.id));
  }
  await saveChange(batch.commit()); // offline: saved on the device, syncs later
  return moved;
}
