// ---------- Super easy meals (Week 10, idea from the Week 12 plan) ----------
//
// TheMealDB doesn't have basic college meals like a peanut butter sandwich,
// so SmartPantry has its own short list. They're ranked with the same
// Week 9 scoring as TheMealDB recipes, so meals that use food expiring soon
// (and meals you have everything for) come first.
//
// Plain logic with no internet calls, so it is easy to unit test in Week 11.

import { byBestMatch, MatchedIngredient, pantryHas, RankedRecipe, scoreRecipe } from "./matching";
import type { RecipeDetails } from "./recipes";

type SimpleMeal = Omit<RecipeDetails, "thumbnail" | "area" | "category" | "youtube" | "source"> & {
  emoji: string;
};

// Ids start with "easy-" so the recipe page knows not to ask TheMealDB for them
export const SIMPLE_MEALS: SimpleMeal[] = [
  {
    id: "easy-pbj",
    name: "Peanut Butter & Jelly Sandwich",
    emoji: "🥪",
    ingredients: [
      { name: "Bread", measure: "2 slices" },
      { name: "Peanut Butter", measure: "2 tbsp" },
      { name: "Jam", measure: "1 tbsp" },
    ],
    steps: ["Spread peanut butter on one slice of bread and jam on the other.", "Press them together and enjoy."],
  },
  {
    id: "easy-breakfast-burrito",
    name: "Egg Breakfast Burrito",
    emoji: "🌯",
    ingredients: [
      { name: "Eggs", measure: "2" },
      { name: "Tortilla", measure: "1" },
    ],
    steps: [
      "Crack the eggs into a bowl and whisk with a fork.",
      "Cook in a pan over medium heat, stirring, for about 2 minutes until set.",
      "Warm the tortilla for 15 seconds in the microwave, fill with the eggs, and roll it up.",
    ],
  },
  {
    id: "easy-scrambled-toast",
    name: "Scrambled Eggs on Toast",
    emoji: "🍳",
    ingredients: [
      { name: "Eggs", measure: "2" },
      { name: "Bread", measure: "1 slice" },
      { name: "Butter", measure: "1 tsp" },
    ],
    steps: [
      "Toast the bread.",
      "Melt the butter in a pan, add the whisked eggs, and stir over medium heat until just set.",
      "Pile the eggs on the toast.",
    ],
  },
  {
    id: "easy-fried-egg-sandwich",
    name: "Fried Egg Sandwich",
    emoji: "🥚",
    ingredients: [
      { name: "Eggs", measure: "1" },
      { name: "Bread", measure: "2 slices" },
      { name: "Butter", measure: "1 tsp" },
    ],
    steps: [
      "Melt the butter in a pan and fry the egg for 2-3 minutes.",
      "Put it between the two slices of bread (toasted if you like).",
    ],
  },
  {
    id: "easy-grilled-cheese",
    name: "Grilled Cheese",
    emoji: "🧀",
    ingredients: [
      { name: "Bread", measure: "2 slices" },
      { name: "Cheese", measure: "2 slices" },
      { name: "Butter", measure: "1 tbsp" },
    ],
    steps: [
      "Butter one side of each slice of bread.",
      "Put the cheese between the slices, buttered sides out.",
      "Cook in a pan over medium heat for 2-3 minutes per side until golden and melted.",
    ],
  },
  {
    id: "easy-quesadilla",
    name: "Cheese Quesadilla",
    emoji: "🫓",
    ingredients: [
      { name: "Tortilla", measure: "2" },
      { name: "Cheese", measure: "1/2 cup shredded" },
    ],
    steps: [
      "Sprinkle the cheese on one tortilla and put the other on top.",
      "Cook in a dry pan over medium heat for about 2 minutes per side, until the cheese melts.",
      "Cut into wedges.",
    ],
  },
  {
    id: "easy-mac-and-cheese",
    name: "Boxed Mac and Cheese",
    emoji: "🧀",
    ingredients: [
      { name: "Mac and Cheese", measure: "1 box" },
      { name: "Milk", measure: "1/4 cup" },
      { name: "Butter", measure: "2 tbsp" },
    ],
    steps: [
      "Boil the noodles for 7-8 minutes, then drain.",
      "Stir in the cheese packet, milk, and butter until creamy.",
    ],
  },
  {
    id: "easy-ramen",
    name: "Instant Ramen with Egg",
    emoji: "🍜",
    ingredients: [
      { name: "Ramen Noodles", measure: "1 pack" },
      { name: "Eggs", measure: "1" },
    ],
    steps: [
      "Boil 2 cups of water and add the noodles and seasoning packet.",
      "Crack the egg into the pot and cook for 3 minutes without stirring, then serve.",
    ],
  },
  {
    id: "easy-cereal",
    name: "Cereal and Milk",
    emoji: "🥣",
    ingredients: [
      { name: "Cereal", measure: "1 bowl" },
      { name: "Milk", measure: "1 cup" },
    ],
    steps: ["Pour the cereal into a bowl and add the milk."],
  },
  {
    id: "easy-oatmeal",
    name: "Microwave Oatmeal",
    emoji: "🥣",
    ingredients: [
      { name: "Oats", measure: "1/2 cup" },
      { name: "Milk", measure: "1 cup" },
    ],
    steps: [
      "Mix the oats and milk in a large microwave-safe bowl.",
      "Microwave for 2 minutes, stir, and let it sit for 1 minute. Add sugar or fruit if you like.",
    ],
  },
  {
    id: "easy-yogurt-parfait",
    name: "Yogurt Parfait",
    emoji: "🍓",
    ingredients: [
      { name: "Yogurt", measure: "1 cup" },
      { name: "Granola", measure: "1/4 cup" },
      { name: "Banana", measure: "1" },
    ],
    steps: ["Slice the banana.", "Layer yogurt, granola, and banana in a bowl or cup."],
  },
  {
    id: "easy-pb-banana-toast",
    name: "Peanut Butter Banana Toast",
    emoji: "🍌",
    ingredients: [
      { name: "Bread", measure: "1 slice" },
      { name: "Peanut Butter", measure: "1 tbsp" },
      { name: "Banana", measure: "1/2" },
    ],
    steps: ["Toast the bread and spread on the peanut butter.", "Top with banana slices."],
  },
  {
    id: "easy-ham-cheese-sandwich",
    name: "Ham and Cheese Sandwich",
    emoji: "🥪",
    ingredients: [
      { name: "Bread", measure: "2 slices" },
      { name: "Ham", measure: "2 slices" },
      { name: "Cheese", measure: "1 slice" },
    ],
    steps: ["Layer the ham and cheese between the bread."],
  },
  {
    id: "easy-tuna-sandwich",
    name: "Tuna Sandwich",
    emoji: "🐟",
    ingredients: [
      { name: "Tuna", measure: "1 can" },
      { name: "Mayonnaise", measure: "1 tbsp" },
      { name: "Bread", measure: "2 slices" },
    ],
    steps: ["Drain the tuna and mix it with the mayonnaise.", "Spread it between the slices of bread."],
  },
  {
    id: "easy-pasta-sauce",
    name: "Pasta with Jar Sauce",
    emoji: "🍝",
    ingredients: [
      { name: "Pasta", measure: "2 cups" },
      { name: "Pasta Sauce", measure: "1 cup" },
    ],
    steps: [
      "Boil the pasta for the time on the box, then drain.",
      "Warm the sauce in the same pot and stir the pasta back in.",
    ],
  },
  {
    id: "easy-baked-potato",
    name: "Microwave Baked Potato",
    emoji: "🥔",
    ingredients: [
      { name: "Potatoes", measure: "1" },
      { name: "Butter", measure: "1 tbsp" },
      { name: "Cheese", measure: "1/4 cup shredded" },
    ],
    steps: [
      "Wash the potato and poke it all over with a fork.",
      "Microwave for 5 minutes, flip it, and microwave 3-5 more minutes until soft.",
      "Cut it open and add the butter and cheese.",
    ],
  },
  {
    id: "easy-nachos",
    name: "Microwave Nachos",
    emoji: "🌮",
    ingredients: [
      { name: "Tortilla Chips", measure: "1 plate" },
      { name: "Cheese", measure: "1/2 cup shredded" },
    ],
    steps: ["Spread the chips on a plate and cover with cheese.", "Microwave for 45-60 seconds until melted."],
  },
  {
    id: "easy-rice-beans",
    name: "Rice and Beans",
    emoji: "🍚",
    ingredients: [
      { name: "Rice", measure: "1 cup cooked" },
      { name: "Beans", measure: "1 can" },
    ],
    steps: [
      "Cook the rice (or microwave a ready rice pouch).",
      "Drain and warm the beans, then serve them over the rice.",
    ],
  },
];

// True when the pantry has every ingredient (salt, pepper and water don't count)
export function isReadyToCook(recipe: RankedRecipe) {
  return recipe.totalCount > 0 && recipe.haveCount >= recipe.totalCount;
}

export function isSimpleMeal(id: string) {
  return id.startsWith("easy-");
}

// The recipe page's view of a simple meal
export function simpleMealDetails(id: string): RecipeDetails | null {
  const meal = SIMPLE_MEALS.find((m) => m.id === id);
  if (!meal) return null;
  return { ...meal, thumbnail: "", area: "", category: "Super easy", youtube: null, source: null };
}

// Score every simple meal against the pantry, best first.
// `soonest` is the pantry's usable food: ingredient name -> days until it expires.
export function rankSimpleMeals(soonest: Map<string, number | null>): RankedRecipe[] {
  const pantryNames = [...soonest.keys()];
  return SIMPLE_MEALS.map((meal) => {
    // Which pantry items this meal uses up, and how soon each expires
    const matched: MatchedIngredient[] = [];
    for (const ing of meal.ingredients) {
      const pantryName = pantryNames.find((name) => pantryHas(ing.name, [name]));
      if (pantryName && !matched.some((m) => m.name === pantryName)) {
        matched.push({ name: pantryName, daysLeft: soonest.get(pantryName) ?? null });
      }
    }
    const words = meal.steps.join(" ").split(/\s+/).length;
    return scoreRecipe(
      { id: meal.id, name: meal.name, thumbnail: "", emoji: meal.emoji },
      matched,
      meal.ingredients.map((ing) => ing.name),
      pantryNames,
      null,
      words
    );
  }).sort((a, b) => Number(isReadyToCook(b)) - Number(isReadyToCook(a)) || byBestMatch(a, b));
}
