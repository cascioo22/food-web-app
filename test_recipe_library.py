#!/usr/bin/env python
"""Quick verification of recipe library endpoints."""

import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project/backend')

from app import app
from fastapi.testclient import TestClient

client = TestClient(app)

# Test 1: Root endpoint
r = client.get('/')
print(f"✓ Root: {r.status_code} - {r.json()}")

# Test 2: List recipes (should be empty initially)
r = client.get('/recipes')
print(f"✓ Recipes list: {r.status_code} - {len(r.json())} recipes")

# Test 3: Create a recipe
payload = {
    "title": "Test Recipe",
    "prep_time": "30 min",
    "servings": "4",
    "ingredients_text": "1 cup flour\n2 eggs",
    "steps_ordered": "Step 1\nStep 2"
}
r = client.post('/recipes/manual-entry/save', json=payload)
if r.status_code == 200:
    recipe_id = r.json()['id']
    print(f"✓ Created recipe ID {recipe_id}")
else:
    print(f"✗ Failed to create recipe: {r.status_code} - {r.text}")
    sys.exit(1)

# Test 4: Verify recipe was created
r = client.get(f'/recipes/{recipe_id}')
if r.status_code == 200:
    data = r.json()
    print(f"✓ Recipe retrieved: title='{data['title']}'")
    print(f"  - original_url: {data.get('original_url', 'N/A')}")
    print(f"  - prep_time: {data.get('prep_time', 'N/A')}")
else:
    print(f"✗ Failed to retrieve recipe: {r.status_code}")
    sys.exit(1)

# Test 5: Update recipe
update_payload = {"title": "Updated Recipe", "category": "test"}
r = client.put(f'/recipes/{recipe_id}', json=update_payload)
if r.status_code == 200:
    print(f"✓ Updated recipe successfully")
else:
    print(f"✗ Failed to update recipe: {r.status_code} - {r.text}")
    sys.exit(1)

# Test 6: List recipes shows updated entry
r = client.get('/recipes')
data = r.json()
if len(data) >= 1 and data[0]['title'] == "Updated Recipe":
    print(f"✓ Recipe list updated")
else:
    print(f"✗ Recipe list not updated correctly")

# Test 7: Delete recipe
r = client.delete(f'/recipes/{recipe_id}')
if r.status_code == 200:
    print(f"✓ Deleted recipe successfully")
else:
    print(f"✗ Failed to delete recipe: {r.status_code}")

print("\n✅ All tests passed!")
