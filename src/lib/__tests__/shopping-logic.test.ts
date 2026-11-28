// Unit tests for the Week 10 smart shopping list (src/lib/shopping-logic.ts).
// Run them with:  npm test

import { describe, expect, it } from "@jest/globals";
import { ShoppingListItem } from "@/types/models";
import {
  combineMeasures,
  groupForDisplay,
  guessCategory,
  missingForRecipe,
  planAddToList,
} from "../shopping-logic";

// A shopping list row with sensible defaults, so each test only sets what it cares about
function item(overrides: Partial<ShoppingListItem>): ShoppingListItem {
  return {
    id: "row",
    name: "Item",
    normalizedName: "item",
    quantity: 1,
    unit: "count",
    category: "other",
    checked: false,
    measure: "",
    sourceRecipeIds: [],
    sourceRecipeNames: [],
    createdAt: null as unknown as ShoppingListItem["createdAt"],
    ...overrides,
  };
}

describe("missingForRecipe", () => {
  it("returns only what the pantry doesn't have", () => {
    const missing = missingForRecipe(
      [
        { name: "Chicken", measure: "2" },
        { name: "Onion", measure: "1 chopped" },
      ],
      ["chicken breast"]
    );
    expect(missing).toEqual([{ name: "Onion", measure: "1 chopped" }]);
  });

  it("skips salt, pepper and water", () => {
    const missing = missingForRecipe(
      [
        { name: "Salt", measure: "pinch" },
        { name: "Pepper", measure: "pinch" },
        { name: "Water", measure: "1 cup" },
      ],
      []
    );
    expect(missing).toEqual([]);
  });

  it("doesn't list the same ingredient twice", () => {
    const missing = missingForRecipe(
      [
        { name: "Onions", measure: "2" },
        { name: "onion", measure: "1" },
      ],
      []
    );
    expect(missing).toEqual([{ name: "Onions", measure: "2" }]);
  });
});

describe("planAddToList", () => {
  const onionRow = item({ id: "r1", name: "Onion", normalizedName: "onion", measure: "2", sourceRecipeIds: ["fajitas"] });

  it("adds new rows for items not on the list", () => {
    const plan = planAddToList([{ name: "Garlic", measure: "3 cloves" }], "soup", [onionRow]);
    expect(plan.add).toEqual([{ name: "Garlic", measure: "3 cloves" }]);
    expect(plan.merge).toEqual([]);
  });

  it("merges into an existing row when another recipe needs it too", () => {
    const plan = planAddToList([{ name: "Onions", measure: "1 chopped" }], "soup", [onionRow]);
    expect(plan.add).toEqual([]);
    expect(plan.merge).toEqual([{ id: "r1", measure: "2 + 1 chopped" }]);
  });

  it("doesn't add anything again when the same recipe is added twice", () => {
    const plan = planAddToList([{ name: "Onion", measure: "2" }], "fajitas", [onionRow]);
    expect(plan.alreadyAdded).toBe(1);
    expect(plan.add).toEqual([]);
    expect(plan.merge).toEqual([]);
  });

  it("adds a new row if the existing one is already checked off", () => {
    const plan = planAddToList([{ name: "Onion", measure: "1" }], "soup", [{ ...onionRow, checked: true }]);
    expect(plan.add).toEqual([{ name: "Onion", measure: "1" }]);
  });
});

describe("combineMeasures", () => {
  it("joins two amounts with a plus", () => {
    expect(combineMeasures("2 cups", "1 tbsp")).toBe("2 cups + 1 tbsp");
  });

  it("skips blank amounts", () => {
    expect(combineMeasures("", " 1 tbsp ")).toBe("1 tbsp");
    expect(combineMeasures("", "")).toBe("");
  });
});

describe("guessCategory", () => {
  it("puts common items in the right store section", () => {
    expect(guessCategory("Cherry Tomatoes")).toBe("produce");
    expect(guessCategory("Cheddar Cheese")).toBe("dairy");
    expect(guessCategory("Chicken Thighs")).toBe("meat");
    expect(guessCategory("Spaghetti")).toBe("grains");
  });

  it("uses the longest matching word when several match", () => {
    expect(guessCategory("Coconut Milk")).toBe("canned"); // not dairy
    expect(guessCategory("Black Pepper")).toBe("spices"); // not produce
    expect(guessCategory("Chicken Stock")).toBe("canned"); // not meat
  });

  it("falls back to other for unknown items", () => {
    expect(guessCategory("Dish Soap")).toBe("other");
  });
});

describe("groupForDisplay", () => {
  const title = (c: string) => c.toUpperCase();

  it("groups unchecked items by store section in store order, A-Z inside", () => {
    const sections = groupForDisplay(
      [
        item({ id: "1", name: "Milk", category: "dairy" }),
        item({ id: "2", name: "Onion", category: "produce" }),
        item({ id: "3", name: "Apple", category: "produce" }),
      ],
      title
    );
    expect(sections.map((s) => s.title)).toEqual(["PRODUCE", "DAIRY"]);
    expect(sections[0].data.map((i) => i.name)).toEqual(["Apple", "Onion"]);
  });

  it("puts checked items in an 'In your cart' section at the bottom", () => {
    const sections = groupForDisplay(
      [item({ id: "1", name: "Rice", category: "grains", checked: true }), item({ id: "2", name: "Lime", category: "produce" })],
      title
    );
    expect(sections.map((s) => s.title)).toEqual(["PRODUCE", "In your cart"]);
  });

  it("returns no sections for an empty list", () => {
    expect(groupForDisplay([], title)).toEqual([]);
  });
});
