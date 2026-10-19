#!/usr/bin/env python3
import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')

from backend.app_new import SessionLocal, Recipe, Nutrition, NutritionResponse

with SessionLocal() as db:
    # Check if nutrition record exists for recipe 2
    recipes = db.query(Recipe).filter_by(id=2).first()
    print(f'Recipe 2 exists: {recipes is not None}')
    
    if recipes:
        nutrition = db.query(Nutrition).filter_by(recipe_id=2).first()
        print(f'Nutrition record for recipe 2: {nutrition is not None}')
        
        if nutrition:
            print(f'\nNutrition data fields:')
            for key, value in nutrition.__dict__.items():
                if not key.startswith('_'):
                    print(f'  {key}: {value} (type={type(value).__name__})')
            
            print('\nAttempting NutritionResponse.model_validate...')
            try:
                response = NutritionResponse.model_validate(nutrition)
                print(f'Successfully validated! Response nutrition field:')
                print(f'  response.nutrition = {response}')
            except Exception as e:
                import traceback
                print(f'Validation error: {type(e).__name__}: {e}')
                traceback.print_exc()
