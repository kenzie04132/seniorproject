// Unit tests for the Week 9 waste-reduction matching (src/lib/matching.ts).
// Run them with:  npm test

import { describe, expect, it } from "@jest/globals";
import {
  byBestMatch,
  pantryHas,
  recipeDifficulty,
  scoreRecipe,
  simplifyName,
  toMealDbName,
  urgencyPoints,
} from "../matching";

const recipe = { id: "1", name: "Chicken Stir Fry", thumbnail: "" };

describe("urgencyPoints", () => {
  it("gives the most points to food expiring today or tomorrow", () => {
    expect(urgencyPoints(-2)).toBe(5); // already expired
    expect(urgencyPoints(0)).toBe(5);
    expect(urgencyPoints(1)).toBe(5);
  });

  it("gives fewer points the longer the food will last", () => {
    expect(urgencyPoints(3)).toBe(4);
    expect(urgencyPoints(7)).toBe(3);
    expect(urgencyPoints(14)).toBe(2);
    expect(urgencyPoints(30)).toBe(1);
  });

  it("gives 1 point to food with no expiration date", () => {
    expect(urgencyPoints(null)).toBe(1);
  });
});

describe("simplifyName", () => {
  it("lowercases, trims and makes the last word singular", () => {
    expect(simplifyName("  Tomatoes ")).toBe("tomato");
    expect(simplifyName("Chicken Breasts")).toBe("chicken breast");
    expect(simplifyName("Eggs")).toBe("egg");
  });

  it("leaves words ending in ss alone", () => {
    expect(simplifyName("Watercress")).toBe("watercress");
  });
});

describe("toMealDbName", () => {
  const known = ["Chicken", "Chicken Breast", "Rice"];

  it("turns a brand name into the recipe database's ingredient name", () => {
    expect(toMealDbName("Tyson Chicken Breast", known)).toBe("chicken breast");
  });

  it("picks the longest matching name", () => {
    expect(toMealDbName("Chicken Breasts", known)).toBe("chicken breast");
  });

  it("keeps the user's name when nothing matches", () => {
    expect(toMealDbName(" Kimchi ", known)).toBe("kimchi");
  });
});

describe("pantryHas", () => {
  it("counts a more specific pantry item as having the ingredient", () => {
    expect(pantryHas("Chicken", ["chicken breast"])).toBe(true);
  });

  it("does not count a less specific pantry item", () => {
    expect(pantryHas("Chicken Stock", ["chicken"])).toBe(false);
  });

  it("ignores plurals and capital letters", () => {
    expect(pantryHas("Onions", ["onion"])).toBe(true);
  });

  it("returns false for an empty pantry", () => {
    expect(pantryHas("Rice", [])).toBe(false);
  });
});

describe("recipeDifficulty", () => {
  it("is Easy for few ingredients and short instructions", () => {
    expect(recipeDifficulty(5, 100)).toBe("Easy");
  });

  it("is Hard for many ingredients or long instructions", () => {
    expect(recipeDifficulty(13, 100)).toBe("Hard");
    expect(recipeDifficulty(5, 400)).toBe("Hard");
  });

  it("is Medium in between, or when instructions didn't load", () => {
    expect(recipeDifficulty(10, 200)).toBe("Medium");
    expect(recipeDifficulty(3, 0)).toBe("Medium");
  });
});

describe("scoreRecipe", () => {
  it("adds urgency points and a coverage bonus", () => {
    // chicken expires today (5 points), have 1 of 2 ingredients (+1.5)
    const result = scoreRecipe(
      recipe,
      [{ name: "chicken", daysLeft: 0 }],
      ["Chicken", "Onion", "Salt"],
      ["chicken breast"]
    );
    expect(result.score).toBe(6.5);
    expect(result.haveCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it("does not count salt, pepper or water as missing", () => {
    const result = scoreRecipe(recipe, [], ["Salt", "Black Pepper", "Water", "Rice"], []);
    expect(result.missingIngredients).toEqual(["Rice"]);
  });

  it("lists the most urgent pantry items first", () => {
    const result = scoreRecipe(
      recipe,
      [
        { name: "rice", daysLeft: null },
        { name: "carrot", daysLeft: 6 },
        { name: "chicken", daysLeft: 1 },
      ],
      ["Rice", "Carrot", "Chicken"],
      ["rice", "carrot", "chicken"]
    );
    expect(result.matchedIngredients.map((i) => i.name)).toEqual(["chicken", "carrot", "rice"]);
  });

  it("gives no coverage bonus when the full recipe didn't load", () => {
    const result = scoreRecipe(recipe, [{ name: "chicken", daysLeft: 0 }], [], ["chicken"], null, 0, false);
    expect(result.score).toBe(5);
  });
});

describe("byBestMatch", () => {
  // A ranked recipe with just the fields the sort looks at
  const make = (name: string, score: number, have: number, total: number, area: string | null = null) => ({
    ...scoreRecipe({ id: name, name, thumbnail: "" }, [], [], [], area),
    score,
    haveCount: have,
    totalCount: total,
  });

  it("puts recipes from the user's picked regions first", () => {
    const sorted = [make("A", 9, 1, 2), make("B", 2, 1, 2, "Italian")].sort(byBestMatch);
    expect(sorted.map((r) => r.name)).toEqual(["B", "A"]);
  });

  it("then sorts by highest score", () => {
    const sorted = [make("Low", 3, 1, 2), make("High", 8, 1, 2)].sort(byBestMatch);
    expect(sorted.map((r) => r.name)).toEqual(["High", "Low"]);
  });

  it("breaks score ties by how much of the recipe you have, then A-Z", () => {
    const sorted = [make("Zucchini Bake", 5, 1, 4), make("Beef Tacos", 5, 1, 4), make("Omelette", 5, 3, 4)].sort(
      byBestMatch
    );
    expect(sorted.map((r) => r.name)).toEqual(["Omelette", "Beef Tacos", "Zucchini Bake"]);
  });
});
