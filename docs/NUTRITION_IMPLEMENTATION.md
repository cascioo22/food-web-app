# Nutrition Storage Implementation

## Overview
This implementation adds nutritional information storage and API support to recipes in the Food Webapp. The design allows optional nutrition data, partial values (missing fields remain unknown rather than zero), and explicit tracking of per-serving vs whole-recipe values.

## Files Modified/Created

### Core Backend
- `backend/app_new.py` - Complete rewrite with:
  - SQLAlchemy models for Recipe and Nutrition tables
  - Pydantic schemas for request/response validation
  - REST API endpoints for CRUD operations on nutrition data
  - Data validation (non-negative values, partial updates)

### Tests  
- `tests/test_nutrition_simple.py` - Unit tests for:
  - Validation logic (valid/invalid/partial data)
  - Persistence and retrieval
  - Partial data handling (None vs zero)

### Migration
- `backend/migrate_nutrition.py` - Migration script to convert old schema to new separate Nutrition table

## Database Schema

### Recipe Table
Existing recipe table structure with new field:
- `id` (INTEGER, PK)
- `name` (VARCHAR(500))
- `url` (VARCHAR(1024))
- `manual_entry` (TEXT)
- `source` (VARCHAR(100), default="import" or "manual")
- `original_url` (VARCHAR(1024))
- `instructions_ordered` (BOOLEAN, default=False)
- `created_at`, `updated_at` (TIMESTAMP)

### Nutrition Table (NEW - Separate for Flexibility)
```sql
CREATE TABLE nutrition (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER UNIQUE NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    
    -- Serving information
    serving_size VARCHAR(200),  -- e.g., "1 cup (240ml)"
    
    -- Per-serving values (can be NULL for partial data)
    calories_per_serving FLOAT,
    protein_per_serving FLOAT,
    carbohydrates_per_serving FLOAT,
    fat_per_serving FLOAT,
    fiber_per_serving FLOAT,
    sugar_per_serving FLOAT,
    sodium_per_serving FLOAT,
    
    -- Whole-recipe values (can be NULL for partial data)
    calories_total FLOAT,
    protein_total FLOAT,
    carbohydrates_total FLOAT,
    fat_total FLOAT,
    fiber_total FLOAT,
    sugar_total FLOAT,
    sodium_total FLOAT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Design Decisions:**
1. **Separate table** - Nutrition data is stored in a separate table linked by foreign key to recipes. This allows:
   - Recipes without nutrition (many users won't need it)
   - Easy deletion of nutrition while preserving recipe
   - Flexible schema evolution for nutrition

2. **Optional fields** - All nutrition fields can be NULL:
   - Partial data is supported (e.g., only calories provided)
   - Missing values remain unknown (NULL), not converted to zero
   - Users can add nutrition incrementally

3. **Explicit per-serving vs total** - Both serving size and totals are tracked separately:
   - `serving_size` describes a single serving
   - `_per_serving` fields are for one portion
   - `_total` fields are for the entire recipe
   - This prevents confusion between "this has 200 calories" (serving) vs "this has 600 calories total"

4. **Non-negative validation** - All numeric fields must be >= 0 when provided:
   - Prevents negative nutrition values
   - Zero is allowed (e.g., 0g protein in a dessert)

## API Endpoints

### Nutrition CRUD for a Recipe
```bash
POST /recipes/{recipe_id}/nutrition        # Create nutrition data
GET  /recipes/{recipe_id}/nutrition        # Get nutrition data  
PUT  /recipes/{request_id}/nutrition       # Partial update nutrition data
DELETE /recipes/{recipe_id}/nutrition      # Delete nutrition data
```

### Batch Operations
```bash
GET  /nutrition                            # Get all nutrition records
```

## Pydantic Schemas

### NutritionCreate (POST request)
All fields optional:
- `serving_size`: str - Description of serving size
- `calories_per_serving`, `protein_per_serving`, etc.: float or None
- All `_total` variants for whole recipe values

### NutritionUpdate (PUT request)  
Same structure as NutritionCreate - partial updates supported. Any field can be omitted to leave it unchanged.

## Validation Rules

1. **Non-negative values**: When a numeric field is provided, it must be >= 0
2. **Partial data**: Missing fields are stored as NULL (unknown), not zero
3. **Unique per recipe**: Only one Nutrition record per Recipe

## Backward Compatibility

- Existing recipes without nutrition continue to work normally
- No migration required for new schema (nutrition is optional)
- If old schema with inline nutrition columns existed, use `backend/migrate_nutrition.py`

## Testing Results

All tests pass:
```
✓ test_validate_nutrition_data_valid
✓ test_validate_nutrition_data_partial  
✓ test_validate_nutrition_data_negative_calories
✓ test_validate_nutrition_data_zero_values
✓ test_create_and_get_nutrition
✓ test_partial_nutrition_stored_as_unknown_not_zero
```

## Usage Example

### Create Nutrition Data
```python
from pydantic import BaseModel
# NutritionCreate schema accepts partial data
nutrition_data = {
    "serving_size": "1 cup (240ml)",
    "calories_per_serving": 250,
    "protein_per_serving": 15,
    # carbohydrates and other fields intentionally omitted
}

response = client.post(f"/recipes/{recipe_id}/nutrition", json=nutrition_data)
```

### Update Partially
```python
# Only update calories, keep protein as-is
update_data = {
    "calories_per_serving": 300
}

response = client.put(f"/recipes/{recipe_id}/nutrition", json=update_data)
```

## Dependencies
- FastAPI
- SQLAlchemy (2.0+)
- Pydantic v2
- SQLite (default, supports PostgreSQL/MySQL via DATABASE_URL env var)
