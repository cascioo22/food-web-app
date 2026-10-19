#!/usr/bin/env python3
"""Debug nutrition extraction with more details."""

import sys
import json
sys.path.insert(0, '/opt/data/home/food-webapp-project')
from backend.recipe_import import extract_nutrition_json_ld, BeautifulSoup, NUTRITION_FIELDS, _extract_nutrition_values, _parse_nutrition_value_string, _extract_number
from bs4 import BeautifulSoup

html = '''<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Recipe","name":"Debug Nutrition Test 2","nutrition":{"@type":"NutritionInformation","calories":"500 calories","proteinContent":"30 grams of protein"}}
</script>
</head><body></body></html>'''

soup = BeautifulSoup(html, 'html.parser')
json_ld_blocks = soup.find_all('script', type='application/ld+json')

print("=== JSON-LD blocks found ===")
for i, block in enumerate(json_ld_blocks):
    print(f"\nBlock {i}:")
    data = json.loads(block.get_text(strip=True))
    print(json.dumps(data, indent=2))

print("\n\n=== Testing _extract_nutrition_value_string directly ===")

# Test 1: calories field
nutrition_data = {}
value = {"calories": "500 calories"}
_extract_nutrition_values(value, nutrition_data)
print(f"Test 1 (calories): {nutrition_data}")

nutrition_data = {}
value = {"proteinContent": "30 grams of protein"}
_extract_nutrition_values(value, nutrition_data)
print(f"Test 2 (proteinContent): {nutrition_data}")

# Test 3: direct _parse_nutrition_value_string
print("\n=== Testing _parse_nutrition_value_string directly ===")
test_values = ["500 calories", "30 grams of protein"]
for val in test_values:
    nutrition_data = {}
    result = _parse_nutrition_value_string(val, 'calories_per_serving', nutrition_data)
    print(f"Input: '{val}' -> {nutrition_data}")

# Test 4: Check what number is being extracted from "500 calories"
print("\n=== Testing _extract_number ===")
test_strings = ["500 calories", "30 grams of protein", "25 g sugar"]
for s in test_strings:
    num = _extract_number(s)
    print(f"'{s}' -> {num}")

# Test 5: Check the actual JSON-LD data from the HTML
print("\n=== Parsing the actual JSON-LD from HTML ===")
soup = BeautifulSoup(html, 'html.parser')
for block in soup.find_all('script', type='application/ld+json'):
    data = json.loads(block.get_text(strip=True))
    print(f"Full Recipe data keys: {list(data.keys())}")
    nutrition_info = data.get('nutrition', {})
    if nutrition_info:
        print(f"Nutrition info: {json.dumps(nutrition_info, indent=2)}")
        # Check each field
        for field in NUTRITION_FIELDS:
            if field in nutrition_info:
                print(f"  Found {field}: {nutrition_info[field]} (type={type(nutrition_info[field]).__name__})")
