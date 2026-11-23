import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// ---------- Offline support (Week 11) ----------
//
// The pantry, shopping list, and saved recipes come from Firestore, which keeps a copy on
// this device (turned on in firebase.ts). Without internet the app shows that copy, and any
// changes are saved on the device and sent to Firebase as soon as the internet comes back.
//
// This file adds the pieces Firestore doesn't do for us:
//   - knowing whether we're online (for the "You're offline" banner)
//   - not making the user wait on a save that can't finish until the internet is back
//   - keeping a copy of TheMealDB answers, so recipes still show offline

// Does the device have internet right now? On the web the browser tells us.
// (React Native has no navigator.onLine, so there we assume yes.)
export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

// Re-renders the screen whenever the internet goes off or comes back
export function useOnline() {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const update = () => setOnline(isOnline());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

// Firestore shows a change on screen right away, but its promise only finishes when the
// server says "got it". Offline that can take hours, so the Save button would spin forever.
// Online: wait for the server like before. Offline: the change is already saved on this
// device and queued to sync, so carry on now.
export async function saveChange(write: Promise<unknown>): Promise<void> {
  if (isOnline()) {
    await write;
    return;
  }
  write.catch((err) => console.warn("A change made offline couldn't be synced:", err));
}

// ---------- Saved copies of TheMealDB answers ----------

const CACHE_PREFIX = "mealdb:";

// Get JSON from a TheMealDB address. Every good answer is saved on the device, so if the
// internet is down (or TheMealDB is), we use the last saved answer instead.
export async function cachedJson(url: string): Promise<any> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
    const data = await response.json();
    AsyncStorage.setItem(CACHE_PREFIX + url, JSON.stringify(data)).catch(() => {}); // full storage is OK
    return data;
  } catch (err) {
    const saved = await AsyncStorage.getItem(CACHE_PREFIX + url).catch(() => null);
    if (saved) return JSON.parse(saved);
    throw err; // never loaded this one before, so there's nothing to show
  }
}
