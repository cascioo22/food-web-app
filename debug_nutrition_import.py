#!/usr/bin/env python3
"""Debug nutrition import issue."""

import requests
import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')

from backend.recipe_import import extract_nutrition_json_ld, BeautifulSoup

# Test extraction directly
html = '''<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Recipe","name":"Debug Test Recipe","nutrition":{"@type":"NutritionInformation","calories":"250 calories"}}
</script>
</head><body></body></html>'''

soup = BeautifulSoup(html, 'html.parser')
extracted = extract_nutrition_json_ld(soup)

print("=== Direct extraction test ===")
print(f"Extracted nutrition: {extracted}")
print(f"Type: {type(extracted)}")

# Now test via API
BASE_URL = "http://127.0.0.1:8000"

print("\n=== Testing API import ===")
resp = requests.post(
    f"{BASE_URL}/recipes",
    json={
        "name": "Debug Test Recipe 2",
        "url": "http://debug.com/test-recipe-2",
        "instructions_ordered": True,
        "html_content": html
    },
    timeout=10
)

print(f"Import status: {resp.status_code}")
if resp.status_code == 201:
    recipe = resp.json()
    print(f"Recipe data returned:")
    import json
    print(json.dumps(recipe, indent=2))
    
    # Reload after small delay
    import time
    time.sleep(0.5)
    reload_resp = requests.get(f"{BASE_URL}/recipes/2", timeout=5)
    if reload_resp.status_code == 200:
        reloaded = reload_resp.json()
        print(f"\nReloaded recipe:")
        print(json.dumps(reloaded, indent=2))
