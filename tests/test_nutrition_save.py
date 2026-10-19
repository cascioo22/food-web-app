#!/usr/bin/env python3
"""Test if nutrition data is being saved during recipe import."""

import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')

from backend.app_new import SessionLocal, Recipe, Nutrition, create_recipe
import os

print("=== Clearing database ===")
with SessionLocal() as db:
    db.query(Recipe).delete()
    db.query(Nutrition).delete()
    db.commit()

print("\n=== Creating recipe with nutrition via API endpoint ===")

# Create recipe with nutrition
html = '''<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Recipe","name":"Debug Nutrition Test 2","nutrition":{"@type":"NutritionInformation","calories":"500 calories","proteinContent":"30 grams of protein"}}
</script>
</head><body></body></html>'''

with SessionLocal() as db:
    recipe_data = {
        "name": "Debug Nutrition Test 2",
        "url": "http://test.com/debug-nutrition-2",
        "instructions_ordered": True,
        "html_content": html
    }
    
    # Call the create_recipe endpoint directly (not via API)
    from backend.app_new import RecipeResponse
    
    result = create_recipe(recipe_data)
    recipe_id = result.id
    print(f"Created recipe ID: {recipe_id}")
    
    # Check if nutrition record was created
    nutrition = db.query(Nutrition).filter_by(recipe_id=recipe_id).first()
    print(f"Nutrition record exists: {nutrition is not None}")
    
    if nutrition:
        print("\nNutrition fields:")
        for key, value in nutrition.__dict__.items():
            if not key.startswith('_') and key != 'recipe_id':
                print(f"  {key}: {value} (type={type(value).__name__})")
        
        print("\nTrying NutritionResponse.model_validate...")
        try:
            response = NutritionResponse.model_validate(nutrition)
            print(f"SUCCESS! NutritionResponse created")
            print(f"  calories_per_serving: {response.calories_per_serving}")
            print(f"  protein_per_serving: {response.protein_per_serving}")
        except Exception as e:
            import traceback
            print(f"ERROR during validation: {type(e).__name__}: {e}")
            traceback.print_exc()
    else:
        print("\nNo nutrition record found in database!")
