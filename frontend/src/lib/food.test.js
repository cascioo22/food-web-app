import test from "node:test";
import assert from "node:assert/strict";
import { formatList } from "./listExport.js";
import { scaleIngredient, remaining } from "./foodMath.js";
import { readStored, readDraft, api } from "./api.js";
const list = {
  name: "Sunday shop",
  items: [
    {
      id: 9,
      name: "Milk",
      quantity: "1",
      unit: "gallon",
      category: "Dairy",
      notes: "whole",
      completed: false,
    },
    { id: 2, name: "Bread", quantity: "1", unit: "loaf", completed: true },
  ],
};
test("default export excludes purchased and preserves backend order", () => {
  assert.equal(
    formatList(list),
    "Sunday shop\n\n[ ] Milk — 1 gallon\n\n1 item | 0 purchased",
  );
  assert(
    formatList(list, { completed: true }).indexOf("Milk") <
      formatList(list, { completed: true }).indexOf("Bread"),
  );
});
test("export settings retain optional quantities, categories and notes", () => {
  const text = formatList(list, {
    completed: true,
    categories: true,
    notes: true,
  });
  assert.match(text, /Dairy\n\[ \] Milk — 1 gallon \(whole\)/);
  assert.match(text, /\[x\] Bread/);
  assert(!formatList(list, { quantities: false }).includes("gallon"));
});
test("scaling handles supported fractions and preserves ambiguous input", () => {
  for (const [input, factor, want] of [
    ["2 cups flour", 2, "4 cups flour"],
    ["1 1/2 cups milk", 2, "3 cups milk"],
    ["½ cup oil", 3, "1.5 cup oil"],
    ["salt to taste", 2, "salt to taste"],
    ["2–3 eggs", 2, "2–3 eggs"],
    ["3 eggs", 0, "3 eggs"],
    ["1/0 cup", 2, "1/0 cup"],
  ])
    assert.equal(scaleIngredient(input, factor), want);
});
test("timers use deadlines and paused remaining values", () => {
  assert.equal(remaining({ deadline: 10000, paused: false }, 4000), 6000);
  assert.equal(remaining({ deadline: 10000, paused: false }, 20000), 0);
  assert.equal(remaining({ remaining: 3500, paused: true }, 500000), 3500);
});
test("unavailable browser storage has safe read fallbacks", () => {
  assert.deepEqual(readStored("anything", { empty: true }), { empty: true });
  assert.equal(readDraft("anything"), "");
});
test("API exposes error status for conflict recovery and keeps meaningful text", async () => {
  const previous = global.fetch;
  global.fetch = async () => ({
    status: 409,
    ok: false,
    json: async () => ({ detail: "This list changed elsewhere." }),
  });
  try {
    await assert.rejects(
      api("/grocery-lists/1/items/order", "PUT", { ids: [1] }),
      (e) => e.status === 409 && e.message === "This list changed elsewhere.",
    );
  } finally {
    global.fetch = previous;
  }
});

test("meal categories normalize imports without guessing or losing source values", async () => {
  const { mealCategory, mealCategories, mealIllustration } =
    await import("./mealCategories.js");
  assert.deepEqual(mealCategories, ["Breakfast", "Lunch", "Dinner", "Dessert"]);
  for (const [raw, expected] of [
    ["breakfast, brunch, dessert", "Breakfast"],
    ["Main Course", "Dinner"],
    ["desert", "Dessert"],
    ["Chili", ""],
    [null, ""],
  ]) {
    assert.equal(mealCategory(raw), expected);
  }
  assert.equal(mealIllustration("Dinner"), mealIllustration("supper"));
  assert.notEqual(mealIllustration("Breakfast"), mealIllustration("Dessert"));
});
