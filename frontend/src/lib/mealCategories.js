// One vocabulary for filters, editing, and illustrated recipe fallbacks.
export const mealCategories = ["Breakfast", "Lunch", "Dinner", "Dessert"];
const aliases = {
  breakfast: "Breakfast",
  brunch: "Breakfast",
  lunch: "Lunch",
  luncheon: "Lunch",
  dinner: "Dinner",
  supper: "Dinner",
  "main course": "Dinner",
  "main dish": "Dinner",
  dessert: "Dessert",
  desert: "Dessert",
  desserts: "Dessert",
  sweets: "Dessert",
};
export function mealCategory(value) {
  // Prefer the first recognized imported category; never guess from a recipe title.
  return (
    String(value || "")
      .toLowerCase()
      .split(/[,;/|]+/)
      .map((part) => aliases[part.trim()])
      .find(Boolean) || ""
  );
}
export function mealIllustration(value) {
  const category = mealCategory(value);
  return { Breakfast: 2, Lunch: 3, Dinner: 4, Dessert: 0 }[category] ?? 4;
}
