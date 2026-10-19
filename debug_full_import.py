#!/usr/bin/env python3
"""Debug script to trace the full import flow."""

import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project/backend')

# Test 1: Check if extract_nutrition_json_ld returns correct data
print("="*70)
print("TEST 1: Extracting nutrition from HTML")
print("="*70)

from recipe_import import extract_nutrition_json_ld

test_html = '''<html><head>
<script type="application/ld+json">
{
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "name": "Test Recipe",
    "nutrition": {
        "@type": "NutritionInformation",
        "calories": "250 calories"
    }
}
</script>
</head><body></body></html>'''

result = extract_nutrition_json_ld(test_html)
print(f"\nExtraction result: {result}")

if result is None or result == {}:
    print("✗ Extraction returned empty/null - FIX NOT WORKING")
else:
    print("✓ Extraction returned data")
    
    # Check if it has calories
    has_calories = 'calories_per_serving' in result or 'calories' in result
    has_protein = 'protein_per_serving' in result or 'protein' in result
    
    print(f"  Has calories: {has_calories}")
    print(f"  Has protein: {has_protein}")
    
    if has_calories or has_protein:
        print("✓ Result contains valid nutrition data")
    else:
        print("✗ Result is empty but not None - something is wrong")

# Test 2: Check what NutritionCreate validation does with our result
print("\n" + "="*70)
print("TEST 2: Validation of extracted data")
print("="*70)

try:
    from backend.app_new import NutritionCreate, validate_nutrition_data
    
    print(f"\nTrying to create NutritionCreate model from extraction...")
    
    # This will fail if the result doesn't have required fields or has wrong types
    nutrition_data = NutritionCreate(**result)
    validation = validate_nutrition_data(nutrition_data)
    
    print(f"Validation result: {validation}")
    
    if not validation["valid"]:
        print("✗ Validation failed - data won't be saved")
    else:
        print("✓ Validation passed - data will be saved")
        
except Exception as e:
    print(f"✗ Error creating NutritionCreate model: {e}")
    import traceback
    traceback.print_exc()

# Test 3: Check if validation is strict about required fields
print("\n" + "="*70)
print("TEST 3: Checking NutritionCreate model requirements")
print("="*70)

import inspect
from backend.app_new import NutritionCreate

fields = NutritionCreate.model_fields
print(f"\nNutritionCreate fields:")
for field_name, field_info in fields.items():
    is_required = field_info.is_required()
    print(f"  {field_name}: {'required' if is_required else 'optional'}")
