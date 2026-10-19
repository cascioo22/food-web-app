#!/usr/bin/env python3
"""Quick test of nutrition extraction."""
import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')

# Test just the extraction function
from backend.recipe_import import extract_nutrition_json_ld, HAS_BEAUTIFULSOUP

print(f"BeautifulSoup available: {HAS_BEAUTIFULSOUP}")

if not HAS_BEAUTIFULSOUP:
    print("SKIP: bs4 not installed")
    sys.exit(0)

# Test 1: Complete nutrition data
html1 = """<!DOCTYPE html>
<html>
<head>
<script type="application/ld+json">
{
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": "Test Recipe",
    "nutrition": {
        "@type": "NutritionInformation", 
        "calories": 250,
        "proteinContent": 15,
        "fatContent": 8
    }
}
</script>
</head>
</html>"""

print("\nTest 1: Complete nutrition...")
result1 = extract_nutrition_json_ld(html1)
print(f"Result: {result1}")
if result1 is not None and ('calories_per_serving' in result1 or 'calories' in result1):
    print("PASS")
else:
    print("FAIL: Expected nutrition data")

# Test 2: No nutrition data  
html2 = """<!DOCTYPE html>
<html>
<head>
<script type="application/ld+json">
{
    "@type": "Article",
    "headline": "No nutrition here"
}
</script>
</head>
</html>"""

print("\nTest 2: No nutrition...")
result2 = extract_nutrition_json_ld(html2)
print(f"Result: {result2}")
if result2 is None:
    print("PASS")
else:
    print("FAIL: Expected None")

# Test 3: Partial data (just calories)
html3 = """<!DOCTYPE html>
<html>
<head>
<script type="application/ld+json">
{
    "@type": "Recipe",
    "nutrition": {
        "@type": "NutritionInformation",
        "calories": 200
    }
}
</script>
</head>
</html>"""

print("\nTest 3: Partial nutrition...")
result3 = extract_nutrition_json_ld(html3)
print(f"Result: {result3}")
if result3 is not None:
    print("PASS (partial data accepted)")
else:
    print("Note: No partial data returned")

print("\nDone!")
