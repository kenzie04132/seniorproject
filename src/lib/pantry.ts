import {
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { Category, NewPantryItem, PantryItem, Unit } from "@/types/models";
import { pantryCol } from "./collections";

// ---------- Create, read, update, delete ----------

export function addPantryItem(uid: string, item: NewPantryItem) {
  return addDoc(pantryCol(uid), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updatePantryItem(uid: string, id: string, changes: Partial<NewPantryItem>) {
  return updateDoc(doc(pantryCol(uid), id), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

export function deletePantryItem(uid: string, id: string) {
  return deleteDoc(doc(pantryCol(uid), id));
}

export async function getPantryItem(uid: string, id: string) {
  const snap = await getDoc(doc(pantryCol(uid), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as PantryItem) : null;
}

// Live list of the user's pantry, soonest-expiring first.
// Firestore calls us again every time an item is added, edited, or deleted.
export function usePantryItems(uid: string | undefined) {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onSnapshot(
      pantryCol(uid),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PantryItem);
        list.sort(bySoonestExpiration);
        setItems(list);
        setError("");
        setLoading(false);
      },
      () => {
        setError("Couldn't load your pantry. Check your internet connection.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  return { items, loading, error };
}

// ---------- Sorting and expiration helpers ----------

// Items with a date come first (soonest first). Items with no date go last.
function bySoonestExpiration(a: PantryItem, b: PantryItem) {
  const aTime = a.expirationDate?.toMillis() ?? Infinity;
  const bTime = b.expirationDate?.toMillis() ?? Infinity;
  if (aTime !== bTime) return aTime - bTime;
  return a.name.localeCompare(b.name);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Whole days from today until the item expires (negative = already expired)
export function daysUntil(expirationDate: Timestamp | null) {
  if (!expirationDate) return null;
  const diff = startOfDay(expirationDate.toDate()).getTime() - startOfDay(new Date()).getTime();
  return Math.round(diff / DAY_MS);
}

export function expiryLabel(days: number | null) {
  if (days === null) return "No date";
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

// Red = 2 days or less, orange = within a week, gray = later or no date
export function expiryColor(days: number | null) {
  if (days === null) return "#60646c";
  if (days <= 2) return "#d93025";
  if (days <= 7) return "#f29900";
  return "#60646c";
}

// ---------- Dates typed by the user ----------

// "2026-10-20" -> Timestamp at midnight local time, or null if it isn't a real date
export function parseDateInput(text: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null; // e.g. 2026-02-31
  return Timestamp.fromDate(date);
}

// Timestamp -> "2026-10-20" (for filling in the edit form)
export function formatDateInput(timestamp: Timestamp | null) {
  if (!timestamp) return "";
  const d = timestamp.toDate();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// ---------- Choices shown in the form ----------

export const CATEGORIES: Category[] = [
  "produce", "dairy", "meat", "grains", "canned", "frozen", "spices", "beverages", "other",
];

export const UNITS: Unit[] = ["count", "g", "kg", "oz", "lb", "ml", "l", "cup", "tbsp", "tsp"];

export function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}