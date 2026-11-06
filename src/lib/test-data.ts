import { doc, getDocs, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";

import { Category, Unit } from "@/types/models";
import { pantryCol } from "./collections";
import { db } from "./firebase";

// ---------- Sample pantry used for testing ----------
//
// Dates are written as "days from today" instead of real dates, so the test
// pantry always looks the same no matter which day you load it:
// some items expired, some expiring soon (red / orange), some later, some with no date.
// Names use TheMealDB's ingredient names so recipe search finds matches,
// plus one brand name ("Tyson Chicken Breast") to test the Week 9 name matching.

type SampleItem = {
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  daysFromToday: number | null; // null = no expiration date
};

export const SAMPLE_PANTRY: SampleItem[] = [
  // Already expired (should NOT be suggested for recipes)
  { name: "Milk", quantity: 1, unit: "l", category: "dairy", daysFromToday: -2 },
  { name: "Lettuce", quantity: 1, unit: "count", category: "produce", daysFromToday: -1 },

  // Red: expires within 2 days
  { name: "Chicken Breast", quantity: 1, unit: "lb", category: "meat", daysFromToday: 0 },
  { name: "Spinach", quantity: 200, unit: "g", category: "produce", daysFromToday: 1 },
  { name: "Mushrooms", quantity: 8, unit: "oz", category: "produce", daysFromToday: 2 },

  // Orange: expires within a week
  { name: "Minced Beef", quantity: 1, unit: "lb", category: "meat", daysFromToday: 3 },
  { name: "Tomatoes", quantity: 4, unit: "count", category: "produce", daysFromToday: 4 },
  { name: "Cheddar Cheese", quantity: 8, unit: "oz", category: "dairy", daysFromToday: 6 },
  { name: "Tyson Chicken Breast", quantity: 2, unit: "lb", category: "frozen", daysFromToday: 7 },

  // Gray: expires later
  { name: "Eggs", quantity: 12, unit: "count", category: "dairy", daysFromToday: 14 },
  { name: "Carrots", quantity: 1, unit: "lb", category: "produce", daysFromToday: 21 },
  { name: "Potatoes", quantity: 5, unit: "lb", category: "produce", daysFromToday: 30 },
  { name: "Onion", quantity: 3, unit: "count", category: "produce", daysFromToday: 30 },
  { name: "Chopped Tomatoes", quantity: 2, unit: "count", category: "canned", daysFromToday: 365 },

  // No expiration date (should sort last)
  { name: "Rice", quantity: 2, unit: "kg", category: "grains", daysFromToday: null },
  { name: "Spaghetti", quantity: 1, unit: "lb", category: "grains", daysFromToday: null },
  { name: "Garlic", quantity: 1, unit: "count", category: "spices", daysFromToday: null },
  { name: "Olive Oil", quantity: 500, unit: "ml", category: "other", daysFromToday: null },
];

// Midnight local time, N days from today
function daysFromNow(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return Timestamp.fromDate(date);
}

// Adds every sample item to this user's pantry in one write
export async function loadTestPantry(uid: string) {
  const batch = writeBatch(db);
  for (const sample of SAMPLE_PANTRY) {
    const ref = doc(pantryCol(uid));
    batch.set(ref, {
      name: sample.name,
      normalizedName: sample.name.toLowerCase(),
      quantity: sample.quantity,
      unit: sample.unit,
      category: sample.category,
      expirationDate: sample.daysFromToday === null ? null : daysFromNow(sample.daysFromToday),
      barcode: null,
      lowStockThreshold: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// Deletes EVERY item in this user's pantry. Only use it on a test account.
export async function clearPantry(uid: string) {
  const snapshot = await getDocs(pantryCol(uid));
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
