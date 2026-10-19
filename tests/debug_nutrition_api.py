#!/usr/bin/env python3
import requests
import time

BASE_URL = "http://127.0.0.1:8000"

# Clear everything first
print("=== Clearing database ===")
resp = requests.get(f"{BASE_URL}/nutrition", timeout=5)
if resp.status_code == 200:
    for n in resp.json():
        requests.delete(f"{BASE_URL}/nutrition/{n['id']}", timeout=5)

resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
if resp.status_code == 200:
    for r in resp.json():
        requests.delete(f"{BASE_URL}/recipes/{r['id']}", timeout=5)

time.sleep(0.3)

# Import a recipe with nutrition
print("\n=== Creating recipe with nutrition ===")
html = '''<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Recipe","name":"Debug Nutrition Test","nutrition":{"@type":"NutritionInformation","calories":"500 calories","proteinContent":"30 grams of protein"}}
</script>
</head><body></body></html>'''

resp = requests.post(
    f"{BASE_URL}/recipes",
    json={
        "name": "Debug Nutrition Test",
        "url": "http://test.com/debug-nutrition",
        "instructions_ordered": True,
        "html_content": html
    },
    timeout=10
)

print(f"POST /recipes status: {resp.status_code}")
recipe_id = resp.json()['id'] if resp.status_code == 201 else None

if recipe_id:
    time.sleep(0.5)
    
    # Test GET /recipes/2
    print("\n=== GET /recipes/2 ===")
    resp = requests.get(f"{BASE_URL}/recipes/2", timeout=5)
    print(f"Status: {resp.status_code}")
    data = resp.json()
    print(f"Recipe name: {data.get('name')}")
    print(f"Nutrition: {data.get('nutrition', 'NOT FOUND')}")
    
    # Test GET /recipes?limit=10
    print("\n=== GET /recipes ===")
    resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
    print(f"Status: {resp.status_code}")
    data = resp.json()
    if data:
        print(f"Number of recipes: {len(data)}")
        if len(data) > 0:
            r = data[0]
            print(f"First recipe name: {r.get('name')}")
            print(f"First recipe nutrition: {r.get('nutrition', 'NOT FOUND')}")
