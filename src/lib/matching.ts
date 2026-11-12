// ---------- Waste-reduction matching (Week 9) ----------
//
// Ranks recipes so the ones that use up your soonest-expiring food come first.
// Everything in this file is plain logic with no internet calls,
// so it is easy to unit test in Week 11.
//
// How a recipe's score is worked out:
//   1. Each pantry item the recipe uses earns "urgency points":
//        expires today or tomorrow -> 5
//        in 2-3 days               -> 4
//        in 4-7 days               -> 3
//        in 8-14 days              -> 2
//        later, or no date         -> 1
//   2. Add a "coverage bonus" of 0-3 points for how much of the recipe
//      you already have (have all of it = +3, half = +1.5, ...).
//   3. Highest score first. Ties go to the recipe you have more of, then A-Z.
//   4. If the user picked regions, recipes from those regions that use their
//      food come first (still sorted by score), then everything else.
//
// So a recipe that uses chicken expiring today beats one that only uses rice,
// and between two recipes that use the same chicken, the one needing
// fewer extra groceries wins.

export type MatchedIngredient = {
  name: string; // TheMealDB ingredient name, e.g. "chicken breast"
  daysLeft: number | null; // days until the soonest pantry item with this name expires
};

export type RankedRecipe = {
  id: string;
  name: string;
  thumbnail: string;
  matchedIngredients: MatchedIngredient[]; // pantry food this recipe uses up
  haveCount: number; // recipe ingredients you already have
  totalCount: number; // recipe ingredients, not counting salt / pepper / water
  missingIngredients: string[]; // what you'd need to buy (Week 10 shopping list)
  preferredArea: string | null; // which of the user's picked regions it's from, e.g. "Italian"
  score: number;
};

// Things almost every kitchen has. They don't count as "missing".
const STAPLES = new Set(["salt", "pepper", "black pepper", "water"]);

export function urgencyPoints(daysLeft: number | null) {
  if (daysLeft === null) return 1;
  if (daysLeft <= 1) return 5;
  if (daysLeft <= 3) return 4;
  if (daysLeft <= 7) return 3;
  if (daysLeft <= 14) return 2;
  return 1;
}

// "  Tomatoes " -> "tomato", "Chicken Breasts" -> "chicken breast"
export function simplifyName(name: string) {
  const words = name.toLowerCase().trim().split(/\s+/);
  const last = words.pop() ?? "";
  let single = last;
  if (last.endsWith("oes")) single = last.slice(0, -2); // tomatoes -> tomato
  else if (last.endsWith("s") && !last.endsWith("ss")) single = last.slice(0, -1); // eggs -> egg
  return [...words, single].join(" ");
}

// True if `big` contains `small` as whole words: "tyson chicken breast" contains "chicken breast"
function containsWords(big: string, small: string) {
  return ` ${big} `.includes(` ${small} `);
}

// Turn what the user typed into TheMealDB's ingredient name, so brand names still match:
// "Tyson Chicken Breast" -> "chicken breast". Picks the longest known name inside it.
// If nothing matches (or the ingredient list didn't load), keep the user's name.
export function toMealDbName(pantryName: string, knownIngredients: string[]) {
  const name = simplifyName(pantryName);
  let best = "";
  for (const known of knownIngredients) {
    const simple = simplifyName(known);
    if (containsWords(name, simple) && simple.length > best.length) best = known.toLowerCase();
  }
  return best || pantryName.toLowerCase().trim();
}

// Does the pantry have something that covers this recipe ingredient?
// Having "chicken breast" covers a recipe asking for "chicken",
// but having "chicken" does NOT cover "chicken stock".
export function pantryHas(recipeIngredient: string, pantryNames: string[]) {
  const wanted = simplifyName(recipeIngredient);
  return pantryNames.some((name) => containsWords(simplifyName(name), wanted));
}

// Score one recipe. `recipeIngredients` is the recipe's full ingredient list.
export function scoreRecipe(
  recipe: { id: string; name: string; thumbnail: string },
  matchedIngredients: MatchedIngredient[],
  recipeIngredients: string[],
  pantryNames: string[],
  preferredArea: string | null = null
): RankedRecipe {
  const counted = recipeIngredients.filter((ing) => !STAPLES.has(simplifyName(ing)));
  const missingIngredients = counted.filter((ing) => !pantryHas(ing, pantryNames));
  const totalCount = Math.max(counted.length, matchedIngredients.length);
  const haveCount = Math.max(totalCount - missingIngredients.length, matchedIngredients.length);

  const urgency = matchedIngredients.reduce((sum, ing) => sum + urgencyPoints(ing.daysLeft), 0);
  const coverageBonus = totalCount === 0 ? 0 : 3 * (haveCount / totalCount);

  return {
    ...recipe,
    // Show the most urgent pantry items first on the card
    matchedIngredients: [...matchedIngredients].sort(
      (a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity)
    ),
    haveCount,
    totalCount,
    missingIngredients,
    preferredArea,
    score: Math.round((urgency + coverageBonus) * 10) / 10,
  };
}

// Recipes from the user's region first, then highest score,
// then the recipe you have more of, then A-Z
export function byBestMatch(a: RankedRecipe, b: RankedRecipe) {
  return (
    Number(!!b.preferredArea) - Number(!!a.preferredArea) ||
    b.score - a.score ||
    b.haveCount / b.totalCount - a.haveCount / a.totalCount ||
    a.name.localeCompare(b.name)
  );
}
