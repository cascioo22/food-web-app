#!/usr/bin/env python3
"""Debug: Check why nutrition isn't being saved after recipe import."""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

# Get existing recipes to see current state
resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
print("All recipes:")
for r in resp.json():
    print(f"  ID {r['id']}: {r['name']}")
    if r.get('nutrition'):
        print(f"    Nutrition: {r['nutrition']}")

# Check nutrition endpoint directly
resp = requests.get(f"{BASE_URL}/nutrition", timeout=5)
print("\nDirect nutrition query:")
if resp.status_code == 200:
    for n in resp.json():
        print(f"  Recipe {n['recipe_id']}: {n}")

# Try importing a recipe with clear JSON-LD nutrition data
html = '''<!DOCTYPE html>
<html>
<head>
<script type="application/ld+json">
{
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "name": "Debug Nutrition Test",
    "recipeYield": "4 servings",
    "nutrition": {
        "@type": "NutritionInformation", 
        "calories": "250 calories",
        "fatContent": "8 grams of fat"
    }
}
</script>
</head>
<body><h1>Test</h1></body>
</html>'''

print("\n--- Importing recipe with nutrition ---")
resp = requests.post(
    f"{BASE_URL}/recipes",
    json={
        "name": "Debug Nutrition Test",
        "url": "http://example.com/debug-nutrition-" + str(100),
        "instructions_ordered": True,
        "html_content": html
    },
    timeout=10
)

print(f"Import status: {resp.status_code}")
result = resp.json()
print(f"Response: {json.dumps(result, indent=2)}")

# Check if nutrition was saved to the Nutrition table directly via API
print("\n--- Checking /nutrition endpoint after import ---")
resp = requests.get(f"{BASE_URL}/nutrition", timeout=5)
if resp.status_code == 200:
    for n in resp.json():
        print(f"  Recipe {n['recipe_id']}: calories={n.get('calories_per_serving', 'N/A')}, protein={n.get('protein_per_serving', 'N/A')}")

# Now test manual nutrition save to see if that works
recipe_id = result['id']
print(f"\n--- Testing manual nutrition save for recipe {recipe_id} ---")
time.sleep(0.3)
resp = requests.post(
    f"{BASE_URL}/recipes/{recipe_id}/nutrition",
    json={"calories_per_serving": 250, "protein_per_serving": 15},
    timeout=10
)

print(f"Manual nutrition status: {resp.status_code}")
if resp.status_code == 201:
    print("Manual nutrition saved successfully")
    
    # Reload recipe to verify
    reload_resp = requests.get(f"{BASE_URL}/recipes/{recipe_id}", timeout=5)
    reloaded = reload_resp.json()
    print(f"After reload, nutrition: {reloaded.get('nutrition', 'NONE')}")
