# 🥫 SmartPantry

**Track your food, use it before it expires, and cook with what you already have.**

SmartPantry is a household food inventory app. It keeps track of what's in your pantry and when it expires, then suggests recipes that use up your soonest-expiring food first. Anything a recipe needs that you don't have goes on a smart shopping list with one tap. The goal is to cut food waste and save money on groceries.

Built as a senior project with Expo (React Native), TypeScript and Firebase.

---

## ✨ Features

### 🥬 Pantry
- Add, edit and delete food items with quantity, unit, category and expiration date
- **Barcode scanning** with your webcam (or type the number in). The product name and category are filled in from [Open Food Facts](https://world.openfoodfacts.org/)
- Items are sorted soonest-expiring first, with color-coded expiry pills (red = 2 days or less, orange = this week)
- A summary at the top shows how many items you have, how many expire this week and how many have expired
- Filter by category (Produce, Dairy, Meat, Grains, Canned, Frozen, Spices, Beverages)

### 🍳 Recipes
- **Expiring-first matching:** recipes from [TheMealDB](https://www.themealdb.com/) are ranked so the ones that use your most urgent food come first (see [How the matching works](#-how-the-matching-works))
- Shows which pantry items each recipe uses up and how many of its ingredients you already have
- **"Ready to cook"** highlight when you have every ingredient
- Filters for **region** (Italian, Mexican...), **difficulty** (Easy, Medium, Hard) and **diet** (Vegetarian, Vegan, Gluten-free, Dairy-free)
- **Super easy meals:** built-in quick meals TheMealDB doesn't have, like a PB&J or an egg burrito
- **Add your own recipes**, typed in or pasted from a website
- "Not interested" hides recipes you don't want to see again

### 🛒 Smart Shopping List
- One tap adds every missing ingredient from a recipe. Salt, pepper and water are skipped
- No duplicates: if two recipes need onions, they're listed once with both amounts ("2 + 1 chopped")
- Items are grouped by store section, so the list follows the way you walk through a store
- Suggests expired pantry items to buy again
- "Done shopping" moves checked items into your pantry and asks for their expiration dates

### 📶 Works offline
- The pantry, shopping list and recipes you've already seen still work without internet
- Changes made offline sync to the cloud automatically once you're back online
- A "You're offline" banner shows when there's no connection

### 🔒 Accounts
- Sign up and sign in with email and password (Firebase Authentication)
- Each user's pantry, list, recipes and preferences are private to their account

---

## 🧠 How the matching works

Each recipe gets a score, and the highest score is shown first.

1. **Urgency points** for every pantry item the recipe uses:

   | Expires in       | Points |
   | ---------------- | ------ |
   | Today / tomorrow | 5      |
   | 2-3 days         | 4      |
   | 4-7 days         | 3      |
   | 8-14 days        | 2      |
   | Later or no date | 1      |

2. **Coverage bonus** of up to 3 points for how much of the recipe you already have (all of it = +3, half = +1.5).
3. Recipes from your picked regions come first. Ties go to the recipe you have more of, then A-Z.

So a recipe that uses chicken expiring today beats one that only uses rice, and between two recipes that use the same chicken, the one that needs fewer extra groceries wins. Brand names are matched too ("Tyson Chicken Breast" counts as "chicken breast").

---

## 🛠️ Tech stack

| Part           | Technology                                                            |
| -------------- | --------------------------------------------------------------------- |
| App            | [Expo](https://expo.dev/) (React Native) with Expo Router, TypeScript |
| Login          | Firebase Authentication                                               |
| Database       | Cloud Firestore (with offline storage)                                |
| Recipes        | [TheMealDB API](https://www.themealdb.com/api.php)                    |
| Barcode lookup | [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/) |
| Camera         | expo-camera                                                           |
| Testing        | Jest (jest-expo)                                                      |

---

## 🚀 Getting started

### What you need
- [Node.js](https://nodejs.org/) (LTS version)
- A free [Firebase](https://firebase.google.com/) project with **Authentication (Email/Password)** and **Cloud Firestore** turned on

### 1. Get the code
```bash
git clone https://github.com/kenzie04132/seniorproject.git SmartPantry
cd SmartPantry
npm install
```

### 2. Add your Firebase settings
Create a file named `.env` in the project folder with your Firebase web app settings (found in the Firebase console under **Project settings > Your apps**):

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

`.env` is in `.gitignore`, so your keys never get pushed to GitHub.

### 3. Run the app
```bash
npx expo start
```
Then press **w** to open it in your web browser.

> 💡 For sample data while developing, use the **Load sample pantry** button on the Pantry screen. It adds 18 items with different expiration dates. It only shows in development.

---

## ✅ Testing

The app's core logic has automated unit tests (54 tests):

```bash
npm test
```

| Test file                              | What it checks                                                        |
| -------------------------------------- | --------------------------------------------------------------------- |
| `src/lib/__tests__/matching.test.ts`       | Urgency points, name matching, difficulty, recipe scoring and sorting |
| `src/lib/__tests__/shopping-logic.test.ts` | Missing ingredients, no duplicates, store sections, list grouping     |
| `src/lib/__tests__/dietary.test.ts`        | Vegetarian, vegan, gluten-free and dairy-free filters                 |
| `src/lib/__tests__/errors.test.ts`         | Friendly error messages                                               |

---

## 📁 Project structure

```
src/
├── app/                    Screens (Expo Router: each file is a page)
│   ├── (tabs)/
│   │   ├── index.tsx       Pantry
│   │   ├── recipes.tsx     Recipes
│   │   └── shopping.tsx    Shopping List
│   ├── item-form.tsx       Add / edit a pantry item (with barcode scanner)
│   ├── recipe.tsx          Full recipe page
│   ├── my-recipe-form.tsx  Add / edit your own recipe
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── components/             Reusable pieces (barcode scanner, offline banner...)
├── lib/                    App logic
│   ├── matching.ts         Expiring-first recipe scoring
│   ├── shopping-logic.ts   Smart shopping list rules
│   ├── dietary.ts          Dietary filters
│   ├── errors.ts           Friendly error messages
│   ├── offline.ts          Offline support
│   ├── recipes.ts          TheMealDB search
│   ├── barcode.ts          Open Food Facts lookup
│   ├── pantry.ts / shopping.ts / my-recipes.ts / preferences.ts   Firestore reads and writes
│   └── __tests__/          Unit tests
└── types/models.ts         Database shapes (pantry item, shopping item, recipe...)
```

### Database (Cloud Firestore)
```
users/{uid}                     Profile + preferences (diets, regions, hidden recipes)
users/{uid}/pantryItems/{id}    Pantry items
users/{uid}/shoppingList/{id}   Shopping list items
users/{uid}/myRecipes/{id}      Recipes the user added
```

---

## 👩‍💻 Author

**Mackenzie**: senior project, 2026

Recipe data from [TheMealDB](https://www.themealdb.com/). Product data from [Open Food Facts](https://world.openfoodfacts.org/) (Open Database License).
