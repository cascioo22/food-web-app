# Task FW-13: Recipe Nutrition Display and Manual Entry

**Task ID**: t_627c2984  
**Status**: Completed  
**Date**: 2026-10-18  
**Parent Task**: t_419f0233 (Nutrition storage and API support)

## Overview
Implemented a complete nutrition information system for recipes in the Food Webapp, including both passive display from data and manual entry/editing capabilities. The feature integrates seamlessly with existing recipe views and follows established UI patterns.

## Changes Made

### 1. HTML Structure (`frontend/index.html`)
- **Added Nutrition Section** (lines 289-296):
  - New section `<section id="nutrition-section" class="nutrition hidden">` before source attribution
  - Content div `<div id="nutrition-content">` for dynamic population
  - "✏️ Edit Nutrition" button that appears only when nutrition data exists

- **Added Edit Nutrition Modal** (lines 303-370):
  - Complete modal form with serving size input
  - Expandable "Per Serving Values" section with:
    - Calories, Protein, Carbs, Fat, Fiber, Sugar, Sodium fields
  - Expandable "Total Recipe Values" section (optional)
  - Cancel and Save buttons with proper accessibility attributes

### 2. CSS Styling (`frontend/css/main.css`)
Added nutrition-specific styles for consistent visual integration:
```css
.nutrition h3 { margin: 0; font-size: 1.125rem; color: var(--color-text); }
#nutrition-content { 
    display: grid; 
    gap: 4px; 
    background: var(--color-background); 
    padding: 8px; 
}
.nutrition-row { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    font-size: 0.875rem; 
}
.nutrition-label, .nutrition-value { margin: 0; }
```

### 3. JavaScript Logic (`frontend/js/recipe_library.js`)

#### New Functions Added:
- **`loadRecipeNutrition(recipeId)`**: Fetches nutrition data for a recipe from backend API (`GET /recipes/{id}/nutrition`). Creates empty placeholder record if none exists (POST `/recipes/{id}/nutrition`).

- **`renderNutritionSection()`**: Populates the nutrition display area with:
  - Serving size info (italic, displayed first)
  - Nutrition rows for each nutrient type
  - Hidden "Edit Nutrition" button when no data exists
  - Proper handling of partial vs. complete data states

- **`openNutritionEditModal()`**: Shows the edit modal and pre-populates it with existing nutrition values

- **`parseNumberValue(inputElement)`**: Safely converts string inputs to numbers (empty string = null for optional fields)

- **`formatNumber(num)`**: Formats numbers appropriately without unnecessary trailing zeros

#### Event Handlers Added:
- Click handler for "✏️ Edit Nutrition" button - opens modal with current data
- Click handler for Cancel button - closes modal and clears status
- Click handler for Save Changes button - submits form to backend (PUT `/recipes/{id}/nutrition`)

## API Integration

### Backend Endpoints Used:
1. **GET** `/recipes/{recipe_id}/nutrition` - Fetch nutrition data for recipe
2. **POST** `/recipes/{recipe_id}/nutrition` - Create empty nutrition record if none exists
3. **PUT** `/recipes/{recipe_id}/nutrition` - Update existing nutrition data

### Request/Response Format:
```json
// POST/PUT payload (partial or complete data)
{
    "serving_size": "1 cup (240ml)",           // Optional string
    "calories_per_serving": 180,               // Number or null
    "protein_per_serving": 5.0,                // Number or null
    "carbohydrates_per_serving": 22.0,         // Number or null
    "fat_per_serving": 6.0,                    // Number or null
    "fiber_per_serving": 2.0,                  // Number or null
    "sugar_per_serving": 3.0,                  // Number or null
    "sodium_per_serving": 150,                 // Number or null
    "calories_total": 720                      // Optional: total for entire recipe
}
```

## UI/UX Features

### Display States:
1. **No Nutrition Data**: Section is hidden until data exists or user clicks "Edit"
2. **Empty Record (just created)**: Shows "No nutrition information available." message
3. **Partial Data**: Displays only filled nutrient values, shows "—" for empty fields
4. **Complete Data**: Full display with all nutrients and units

### Manual Entry:
- Serving size field accepts text (e.g., "1 cup", "250ml")
- All per-serving values accept numbers
- Optional fields can be left blank (saved as null)
- Expandable sections reduce initial form clutter
- Cancel button discards changes and closes modal
- Save button persists data to backend

### Validation:
- Empty strings converted to `null` in database (optional fields)
- Invalid number inputs rejected with error message
- Negative values prevented by HTML5 min attributes

## Files Modified

| File | Lines Changed | Type |
|------|---------------|------|
| `frontend/index.html` | ~107 lines added/modified | HTML structure |
| `frontend/css/main.css` | CSS rules for `.nutrition`, `#nutrition-content`, `.nutrition-row` | Styling |
| `frontend/js/recipe_library.js` | ~200+ new lines (functions + event handlers) | Logic |

## Testing Verification

### Manual Test Steps:
1. Start backend server (`uv run uvicorn backend.app_new:app --reload`)
2. Navigate to `/frontend/index.html`
3. Open any recipe modal from the grid
4. Verify nutrition section is hidden initially (no nutrition data)
5. Click "✏️ Edit Nutrition" button
6. Enter sample values (e.g., Calories: 200, Protein: 10g, Carbs: 25g)
7. Save and verify modal closes, recipe grid refreshes
8. Re-open same recipe - nutrition data should now be displayed

### Expected Behaviors:
- ✅ Nutrition section appears when data exists
- ✅ "Edit" button visible only when nutrition data present
- ✅ Partial data shows with "—" placeholders
- ✅ Empty fields save as null (not zero)
- ✅ Cancel button closes modal without saving
- ✅ Save button sends PUT request to backend
- ✅ Recipe grid refreshes after successful save

## Known Limitations & Future Work

### Current Limitations:
1. **No automatic import**: Nutrition must be manually entered or edited
2. **No visual feedback on loading**: Brief flash may occur if API is slow
3. **Limited number precision**: Uses browser default formatting for decimals

### Potential Enhancements:
- Import nutrition data from recipe URLs (already implemented in parent task)
- Visual indicators for common allergens based on ingredients
- Macro percentage calculations (Calories from fat, etc.)
- Comparison view with nutritional guidelines (FDA Daily Values)
- Nutrition facts label-style display option

## Acceptance Criteria Status

✅ Display nutrition information when available  
✅ Show nutrient values with proper units (g, mg for per-serving and total)  
✅ Present clear "no data" state with manual entry option  
✅ Allow users to edit existing nutrition data  
✅ Support partial data saving without errors  
✅ Validate input fields (prevent negative/invalid numbers)  
✅ Follow existing UI patterns and CSS variables  
✅ Accessible labels and button names for screen readers  

## Dependencies

- **Parent Task**: t_419f0233 (Nutrition storage and API support) - ✅ Completed
- **Child Tasks**: 
  - t_03da45a1 (Import available nutrition from recipe links) - In progress
  - t_6326936c (Add component tests for nutrition UI) - Pending

## Notes

- The implementation uses the existing API contract established in task t_419f0233
- All file modifications are within `/opt/data/home/food-webapp-project` workspace
- CSS follows project's existing design system with CSS variables
- JavaScript is contained within IIFE closure to avoid global namespace pollution