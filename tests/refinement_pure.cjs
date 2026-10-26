const assert = require("node:assert/strict");
const { formatList } = require("../frontend/js/list_export.js");
const { scaleIngredient, remaining } = require("../frontend/js/food_math.js");
const list = {
  name: "Weekly Groceries",
  items: [
    {
      id: 2,
      name: "Milk",
      quantity: "1",
      unit: "gallon",
      category: "Dairy and eggs",
      notes: "whole",
      completed: false,
    },
    { id: 1, name: "Bread", quantity: "1", unit: "loaf", completed: true },
  ],
};
assert.equal(
  formatList(list),
  "Weekly Groceries\n\n[ ] Milk — 1 gallon\n\n1 items | 0 purchased",
);
assert.match(
  formatList(list, { completed: true, notes: true, categories: true }),
  /Dairy and eggs\n\[ \] Milk — 1 gallon \(whole\)/,
);
assert.match(formatList(list, { completed: true }), /\[x\] Bread/);
assert(!formatList(list, { quantities: false }).includes("gallon"));
assert(
  formatList(list, { completed: true }).indexOf("Milk") <
    formatList(list, { completed: true }).indexOf("Bread"),
);
for (const [source, factor, expected] of [
  ["2 cups flour", 2, "4 cups flour"],
  ["1 1/2 cups milk", 2, "3 cups milk"],
  ["1/2 cup oil", 3, "1.5 cup oil"],
  ["½ cup oil", 2, "1 cup oil"],
  ["salt to taste", 2, "salt to taste"],
  ["2-3 eggs", 2, "2-3 eggs"],
  ["0 eggs", 2, "0 eggs"],
])
  assert.equal(scaleIngredient(source, factor), expected);
assert.equal(remaining({ deadline: 10000, paused: false }, 4000), 6000);
assert.equal(remaining({ deadline: 10000, paused: false }, 20000), 0);
assert.equal(remaining({ remaining: 3500, paused: true }, 100000), 3500);
console.log(
  "PASS: export options/order, conservative scaling, deadline and pause arithmetic",
);
