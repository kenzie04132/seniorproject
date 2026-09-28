import { collection, doc } from "firebase/firestore";
import { db } from "./firebase";

export const userDoc = (uid: string) => doc(db, "users", uid);
export const pantryCol = (uid: string) => collection(db, "users", uid, "pantryItems");
export const shoppingCol = (uid: string) => collection(db, "users", uid, "shoppingList");