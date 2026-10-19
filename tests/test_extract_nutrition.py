#!/usr/bin/env python3
"""Test nutrition extraction directly."""

import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')
from backend.recipe_import import extract_nutrition_json_ld, BeautifulSoup

html = '''<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Recipe","name":"Debug Nutrition Test 2","nutrition":{"@type":"NutritionInformation","calories":"500 calories","proteinContent":"30 grams of protein"}}
</script>
</head><body></body></html>'''

soup = BeautifulSoup(html, 'html.parser')
extracted = extract_nutrition_json_ld(soup)

print("Extracted nutrition data:")
import json
print(json.dumps(extracted, indent=2))
if extracted:
    print(f"\ncalories_per_serving value: {extracted.get('calories_per_serving')}")
    print(f"protein_per_serving value: {extracted.get('protein_per_serving')}")
