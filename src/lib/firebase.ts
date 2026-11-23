import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
// @ts-ignore - typing quirk; this export exists at runtime on native
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app); // already initialized (happens on fast refresh)
  }
}

export { auth };
// Offline cache (Week 11): Firestore keeps a copy of the user's pantry, shopping list, and
// recipes on the device, so they still load without internet. Changes made offline are
// saved on the device and sent to Firebase when the internet comes back.
// On the web the copy lives in the browser's IndexedDB storage and survives a page reload.
// (The phone version of the Firebase web SDK can't save to disk, so it keeps the copy in
// memory while the app is open.)
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache:
      Platform.OS === "web"
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() }) // works with 2+ tabs open
        : memoryLocalCache(),
  });
} catch {
  db = getFirestore(app); // already initialized (happens on fast refresh)
}

export { db };