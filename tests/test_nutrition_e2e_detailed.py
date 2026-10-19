#!/usr/bin/env python3
"""Test nutrition extraction directly via API endpoint."""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

# First, clear the database
print("=== Clearing existing data ===")
resp = requests.get(f"{BASE_URL}/nutrition", timeout=5)
if resp.status_code == 200:
    for n in resp.json():
        try:
            requests.delete(f"{BASE_URL}/nutrition/{n['id']}", timeout=5)
        except:
            pass

resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
if resp.status_code == 200:
    for r in resp.json():
        try:
            requests.delete(f"{BASE_URL}/recipes/{r['id']}", timeout=5)
        except:
            pass

time.sleep(1)

# Create a recipe with detailed nutrition info
html_with_nutrition = '''<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "Recipe",
  "name": "Test Nutrition Extraction",
  "description": "A test recipe with nutrition data",
  "nutrition": {
    "@type": "NutritionInformation",
    "calories": "500 calories",
    "proteinContent": "30 grams of protein"
  }
}
</script>
</head><body>Test Recipe Content</body></html>'''

print("\n=== Creating recipe with nutrition ===")
resp = requests.post(
    f"{BASE_URL}/recipes",
    json={
        "name": "Test Nutrition Extraction",
        "url": "http://test.com/test-nutrition-1",
        "instructions_ordered": True,
        "html_content": html_with_nutrition
    },
    timeout=30
)

print(f"POST /recipes status: {resp.status_code}")
recipe_data = resp.json()
recipe_id = recipe_data.get('id', None)
print(f"Recipe created with ID: {recipe_id}")
print(f"Response preview: {json.dumps(recipe_data, indent=2)[:500]}")

if recipe_id:
    time.sleep(1)
    
    # Get the recipe back and check nutrition
    print("\n=== GET /recipes/1 ===")
    resp = requests.get(f"{BASE_URL}/recipes/1", timeout=5)
    print(f"Status: {resp.status_code}")
    result = resp.json()
    print(f"\nFull response:")
    print(json.dumps(result, indent=2))
    
    if 'nutrition' in result and result['nutrition']:
        nutrition = result['nutrition']
        print(f"\n=== Nutrition Extraction Results ===")
        print(f"calories_per_serving: {nutrition.get('calories_per_serving')} (expected: 500.0)")
        print(f"protein_per_serving: {nutrition.get('protein_per_serving')} (expected: 30.0)")
        
        if nutrition.get('calories_per_serving') == 500.0 and nutrition.get('protein_per_serving') == 30.0:
            print("\n✓ SUCCESS! Both nutrition fields extracted correctly!")
        else:
            print("\n✗ FAIL! Nutrition extraction has issues.")
