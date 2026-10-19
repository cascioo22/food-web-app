#!/usr/bin/env python3
"""Quick test of recipe_import.py extract_nutrition_json_ld directly."""

import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project/backend')

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

print("Testing extract_nutrition_json_ld with string-formatted nutrition...")
result = extract_nutrition_json_ld(test_html)

print(f"\nResult: {result}")

if not result:
    print("\n✗ FAILED: Extraction returned empty result!")
else:
    calories = result.get('calories_per_serving') or result.get('calories')
    if calories:
        print(f"✓ SUCCESS: Extracted calories_per_serving = {calories}")
    else:
        print("✗ FAILED: No calories in result despite non-empty extraction")
