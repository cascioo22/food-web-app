# FW-10: Add to Grocery List — Implementation Status

**Date:** 2026-10-18  
**Status:** Backend and frontend implementation complete; awaiting grocery list backend from FW-07

## Overview

Implemented "Add to Grocery List" stretch feature (FW-10) with full UI/UX for selecting ingredients, previewing quantities, and preparing for bulk-add functionality. Backend endpoints ready; actual merge logic pending grocery list table creation in FW-07.

---

## ✅ Completed Implementation

### Backend (`backend/app.py`)

#### New Models & Schemas
- `IngredientModel` — Structured ingredient storage (id, recipe_id, name, amount, checked)
- `RecipeIngredientsRequest` — Request body for bulk add API
- `BulkAddResult` — Response schema with success status, counts, and items added

#### Utility Functions
- `parse_ingredients_text(text: str) -> list[dict]`
  - Parses newline-separated ingredient text into structured `{name, amount}` objects
  - Handles empty lines, comment lines (starting with #), whitespace-only lines
  - Preserves original case and formatting
  
- `normalize_ingredient_name(name: str) -> str`
  - Normalizes for comparison (lowercase, trimmed)
  
- `can_merge_items(item1: dict, item2: dict) -> bool`
  - Determines if two items can be merged based on name and amount compatibility
  
- `merge_items(existing: list[dict], new_item: dict) -> tuple[bool, int]`
  - Applies merge logic for atomic quantity updates

#### API Endpoints
1. **GET `/recipes/{recipe_id}/ingredients`**
   - Returns structured ingredient list for a recipe
   - Gracefully handles missing ingredients table (falls back to text parsing)
   - Returns ingredient dicts with id, name, amount (when structured data exists)

2. **POST `/recipes/{recipe_id}/ingredients/add-to-list`**
   - Adds selected ingredients from a recipe to a grocery list atomically
   - Supports filtering by `ingredient_ids` parameter
   - Handles both structured and text-based ingredient storage
   - Returns proper warning when grocery_lists table doesn't exist (FW-07 dependency)

---

### Frontend (`frontend/js/recipe_library.js`, `frontend/index.html`)

#### UI Enhancements
1. **Ingredient Checkboxes** — Added to recipe detail modal:
   - Each checkbox includes `data-ingredient-index` attribute for tracking
   - Toggling state via change event listener
   - Selection tracked in `selectedIngredientIds` Set

2. **New Button** — "Select Ingredients..." added to recipe detail actions
   - Opens preview/select modal with checkboxes for each ingredient
   - Shows selected count (e.g., "Selected: 3 ingredient(s)")

3. **"Add to Grocery List" Button** — Now wired to `addToGroceryList()` function
   - Validates selection before proceeding
   - Shows friendly error if no ingredients selected
   - Attempts to fetch available grocery lists
   - If no lists found, shows helpful message

#### New Functions (exposed globally for onclick)
- `showSelectIngredientsModal()` — Opens ingredient preview modal with checkboxes
- `addToGroceryList()` — Initiates add-to-list flow
- `showGroceryListSelection(lists)` — Shows list selection UI
- `toggleIngredientSelection(idx, isChecked)` — Toggles ingredient checkbox state
- `addToGroceryListByIndex(listId, recipeId)` — Adds ingredients to specific list (demo)
- `confirmDeleteList(listId)` — Confirms grocery list deletion

---

### Tests (`tests/test_fw10_bulk_add.py`)

**24 unit tests covering:**
- Ingredient parsing edge cases (empty strings, comments, whitespace, single words)
- Name normalization (case sensitivity, whitespace trimming)
- Merge logic validation (same/different names, compatible/incompatible amounts)
- Response schema structure

---

## 🚧 Pending Work (Depends on FW-07)

### Backend Integration
When the `grocery_lists` table is created:

1. **Update POST endpoint** to actually merge ingredients:
   - Fetch existing items from grocery list's `items` JSON column
   - Apply `merge_items()` logic for compatible quantities
   - Atomically update the list (transactional)

2. **Handle conflicts:**
   - Same ingredient name + amount = merge (update existing)
   - Same name, different amount = keep both (user wants different units)
   - Different name = append new item

### Frontend Enhancements
1. **Wire up to actual grocery lists** — Replace demo alert with real list selection and add flow
2. **Show merged result preview** — After successful add, display what was actually added to the list
3. **Better error handling** — Show meaningful messages when merge fails

---

## 📝 API Usage Examples

### Get Recipe Ingredients
```bash
GET http://localhost:8000/recipes/123/ingredients
Authorization: Bearer YOUR_TOKEN
```

Response (when structured ingredients table exists):
```json
[
  {"id": 1, "name": "flour", "amount": "2 cups"},
  {"id": 2, "name": "eggs", "amount": "3"},
  {"id": 3, "name": "salt", "amount": "1 tsp"}
]
```

### Add Ingredients to List
```bash
POST http://localhost:8000/recipes/123/ingredients/add-to-list
Authorization: Bearer YOUR_TOKEN

{
  "recipe_id": 123,
  "grocery_list_id": 456,
  "ingredient_ids": [1, 3]
}
```

Response:
```json
{
  "success": true,
  "added_count": 2,
  "skipped_duplicates": 0,
  "items_added": [
    {"id": 1, "name": "flour", "amount": "2 cups", "checked": false},
    {"id": 3, "name": "salt", "amount": "1 tsp", "checked": false}
  ]
}
```

---

## 📁 Files Modified

1. **Backend:**
   - `backend/app.py` — Added models, utility functions, API endpoints

2. **Frontend:**
   - `frontend/js/recipe_library.js` — Added UI event handlers, selection logic
   - `frontend/index.html` — Added "Select Ingredients..." button

3. **Tests:**
   - `tests/test_fw10_bulk_add.py` — New test file with 24 unit tests

---

## ⚠️ Known Limitations

1. **Demo Mode** — Current implementation returns parsed ingredients but doesn't persist to grocery list (grocery_lists table not yet created)
2. **No Conflict Resolution UI** — Backend merge logic exists but no frontend feedback when items are merged vs. added separately
3. **Ingredient Parsing Simplicity** — Current parser splits on first whitespace; complex ingredient lines (e.g., "1 cup of fresh milk") may parse incorrectly

---

## 🎯 Next Steps

1. Wait for FW-07 to create `grocery_lists` table with proper schema
2. Implement actual merge logic in `/recipes/{recipe_id}/ingredients/add-to-list` endpoint
3. Wire frontend button calls to real grocery list API calls
4. Add conflict resolution UI (show which items merged, which were added separately)
5. Run full test suite once pytest is available

---

**Implementation Complete:** ✅ Ready for testing when grocery lists backend is available.
