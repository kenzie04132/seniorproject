// Unit tests for the Week 11 dietary filters (src/lib/dietary.ts).
// Run them with:  npm test

import { describe, expect, it } from "@jest/globals";
import { dietProblems, fitsDiets, ingredientFits } from "../dietary";

describe("ingredientFits", () => {
  it("keeps meat and seafood out of vegetarian recipes", () => {
    expect(ingredientFits("Chicken Breast", "vegetarian")).toBe(false);
    expect(ingredientFits("Prawns", "vegetarian")).toBe(false);
    expect(ingredientFits("Chicken Stock", "vegetarian")).toBe(false);
    expect(ingredientFits("Cheddar Cheese", "vegetarian")).toBe(true);
  });

  it("keeps dairy, eggs and honey out of vegan recipes", () => {
    expect(ingredientFits("Eggs", "vegan")).toBe(false);
    expect(ingredientFits("Butter", "vegan")).toBe(false);
    expect(ingredientFits("Honey", "vegan")).toBe(false);
    expect(ingredientFits("Chickpeas", "vegan")).toBe(true);
  });

  it("doesn't get fooled by names that only look like a match", () => {
    expect(ingredientFits("Eggplant", "vegan")).toBe(true);
    expect(ingredientFits("Peanut Butter", "dairy-free")).toBe(true);
    expect(ingredientFits("Coconut Milk", "vegan")).toBe(true);
    expect(ingredientFits("Butternut Squash", "vegan")).toBe(true);
    expect(ingredientFits("Vegetable Stock", "vegetarian")).toBe(true);
  });

  it("keeps wheat out of gluten-free recipes but allows rice and corn flour", () => {
    expect(ingredientFits("Plain Flour", "gluten-free")).toBe(false);
    expect(ingredientFits("Spaghetti", "gluten-free")).toBe(false);
    expect(ingredientFits("Soy Sauce", "gluten-free")).toBe(false);
    expect(ingredientFits("Rice Flour", "gluten-free")).toBe(true);
    expect(ingredientFits("Rice Noodles", "gluten-free")).toBe(true);
    expect(ingredientFits("Potatoes", "gluten-free")).toBe(true);
  });

  it("trusts labels like Vegan or Gluten-free on the product", () => {
    expect(ingredientFits("Vegan Cheese", "vegan")).toBe(true);
    expect(ingredientFits("Gluten-free Pasta", "gluten-free")).toBe(true);
    expect(ingredientFits("Gluten-free Pasta", "vegan")).toBe(true);
  });

  it("ignores capital letters and extra spaces", () => {
    expect(ingredientFits("  MOZZARELLA ", "dairy-free")).toBe(false);
  });
});

describe("dietProblems", () => {
  it("lists the ingredients that break a diet", () => {
    expect(dietProblems(["Rice", "Chicken", "Onion", "Butter"], ["vegetarian", "dairy-free"])).toEqual([
      "Chicken",
      "Butter",
    ]);
  });
});

describe("fitsDiets", () => {
  const stirFry = ["Tofu", "Broccoli", "Rice Noodles", "Garlic", "Ginger"];

  it("is true when every diet is OK", () => {
    expect(fitsDiets(stirFry, ["vegan", "gluten-free", "dairy-free"])).toBe(true);
  });

  it("is false when any diet is broken", () => {
    expect(fitsDiets([...stirFry, "Soy Sauce"], ["vegan", "gluten-free"])).toBe(false);
  });

  it("lets everything through when no diet is picked", () => {
    expect(fitsDiets(["Bacon", "Bread"], [])).toBe(true);
  });
});
