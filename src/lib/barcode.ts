import { Category } from "@/types/models";

export type ProductInfo = {
  barcode: string;
  name: string;
  category: Category;
};

const CATEGORY_KEYWORDS: [string, Category][] = [
  ["frozen", "frozen"],
  ["canned", "canned"],
  ["beverage", "beverages"],
  ["drink", "beverages"],
  ["juice", "beverages"],
  ["sodas", "beverages"],
  ["coffee", "beverages"],
  ["dair", "dairy"], // dairy, dairies
  ["milk", "dairy"],
  ["cheese", "dairy"],
  ["yogurt", "dairy"],
  ["meat", "meat"],
  ["poultry", "meat"],
  ["fish", "meat"],
  ["seafood", "meat"],
  ["fruit", "produce"],
  ["vegetable", "produce"],
  ["cereal", "grains"],
  ["bread", "grains"],
  ["pasta", "grains"],
  ["rice", "grains"],
  ["spice", "spices"],
  ["herb", "spices"],
  ["condiment", "spices"],
];

function pickCategory(tags: string[]): Category {
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (tags.some((tag) => tag.includes(keyword))) return category;
  }
  return "other";
}

export async function lookupBarcode(barcode: string): Promise<ProductInfo | null> {
  const code = barcode.trim();
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json` +
    `?fields=product_name,categories_tags`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 1 || !data.product?.product_name) return null;

  return {
    barcode: code,
    name: data.product.product_name,
    category: pickCategory(data.product.categories_tags ?? []),
  };
}