// ---------- Dietary filters (Week 11) ----------
//
// Plain logic with no internet or database calls, so it is easy to unit test.
//
// TheMealDB doesn't say whether a recipe is vegan or gluten-free, so we check
// each ingredient's name against lists of words:
//   vegetarian  -> no meat or seafood
//   vegan       -> no meat, seafood, dairy, eggs or honey
//   gluten-free -> no wheat flour, bread, pasta, soy sauce...
//   dairy-free  -> no milk, cheese, butter, cream...
//
// A word matches the start of a word in the ingredient, so "egg" matches "Eggs".
// Some names look like a match but aren't, e.g. "Peanut Butter" has no dairy and
// "Eggplant" has no egg. Those "safe" phrases are removed before checking.
//
// This is a best guess from ingredient names, so the app tells users to check labels.

export type Diet = "vegetarian" | "vegan" | "gluten-free" | "dairy-free";

// In the order the filter buttons are shown
export const DIETS: { id: Diet; label: string }[] = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "gluten-free", label: "Gluten-free" },
  { id: "dairy-free", label: "Dairy-free" },
];

const MEAT = [
  "chicken", "beef", "pork", "lamb", "bacon", "sausage", "ham", "turkey", "steak", "veal", "duck",
  "goose", "chorizo", "prosciutto", "pancetta", "salami", "pepperoni", "gelatin", "gelatine", "lard",
  "suet", "venison", "mutton", "meatball", "hot dog", "frankfurter",
];
const SEAFOOD = [
  "fish", "salmon", "tuna", "prawn", "shrimp", "cod", "haddock", "anchov", "sardine", "mackerel",
  "crab", "lobster", "mussel", "clam", "oyster", "squid", "scallop", "tilapia", "trout", "halibut",
  "monkfish", "worcestershire", // Worcestershire sauce has anchovies in it
];
const DAIRY = [
  "milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "parmesan", "parmigiano", "mozzarella",
  "cheddar", "feta", "ricotta", "mascarpone", "ghee", "creme fraiche", "crème fraîche", "paneer",
  "brie", "gruyere", "gruyère", "halloumi", "custard", "whey",
];
const EGGS = ["egg", "mayonnaise", "meringue"];
const OTHER_ANIMAL = ["honey"];
const GLUTEN = [
  "flour", "bread", "breadcrumb", "panko", "pasta", "spaghetti", "noodle", "penne", "macaroni",
  "lasagne", "lasagna", "linguine", "fettuccine", "tagliatelle", "farfalle", "fusilli", "rigatoni",
  "orzo", "ravioli", "tortellini", "gnocchi", "udon", "ramen", "couscous", "tortilla", "wheat",
  "barley", "rye", "bulgur", "semolina", "soy sauce", "pastry", "filo", "phyllo", "biscuit",
  "cracker", "bun", "pita", "naan", "baguette", "croissant", "beer", "digestive", "bagel", "muffin",
  "mac and cheese", "cereal", "granola", "oat", // most cereals and oats aren't gluten-free unless labeled
];

// Phrases that contain a word above but don't actually break the diet.
// For example "coconut milk" is dairy-free and "rice flour" is gluten-free.
const SAFE_PHRASES: Partial<Record<Diet, string[]>> & { all: string[] } = {
  all: [
    "coconut milk", "coconut cream", "almond milk", "oat milk", "soy milk", "soya milk", "rice milk",
    "peanut butter", "almond butter", "butternut", "butter bean", "cocoa butter", "cream of tartar",
    "eggplant", "vegetable stock",
  ],
  "gluten-free": [
    "rice flour", "corn flour", "cornflour", "almond flour",
    "coconut flour", "rice noodle", "rice paper", "corn tortilla", "tortilla chip", "buckwheat", "tamari",
  ],
};

// Labels that mean a product was made for the diet, e.g. "Vegan Cheese" or "Gluten-free Pasta"
const MADE_FOR: Record<Diet, string[]> = {
  vegetarian: ["vegetarian", "vegan", "meatless", "meat-free", "plant-based", "plant based"],
  vegan: ["vegan", "plant-based", "plant based"],
  "gluten-free": ["gluten-free", "gluten free"],
  "dairy-free": ["dairy-free", "dairy free", "vegan", "plant-based", "plant based"],
};

// Which word lists each diet rules out
const NOT_ALLOWED: Record<Diet, string[]> = {
  vegetarian: [...MEAT, ...SEAFOOD],
  vegan: [...MEAT, ...SEAFOOD, ...DAIRY, ...EGGS, ...OTHER_ANIMAL],
  "gluten-free": GLUTEN,
  "dairy-free": DAIRY,
};

// True if this one ingredient is OK for this one diet
export function ingredientFits(ingredient: string, diet: Diet) {
  let text = ` ${ingredient.toLowerCase().trim()} `;
  if (MADE_FOR[diet].some((label) => text.includes(label))) return true;
  for (const safe of [...SAFE_PHRASES.all, ...(SAFE_PHRASES[diet] ?? [])]) {
    text = text.split(safe).join(" ");
  }
  return !NOT_ALLOWED[diet].some((word) => text.includes(` ${word}`));
}

// The ingredients that break any of the chosen diets (empty if the recipe fits)
export function dietProblems(ingredients: string[], diets: Diet[]): string[] {
  return ingredients.filter((ing) => diets.some((diet) => !ingredientFits(ing, diet)));
}

// True if the recipe works for every chosen diet. No diets chosen = everything fits.
export function fitsDiets(ingredients: string[], diets: Diet[]) {
  return dietProblems(ingredients, diets).length === 0;
}
