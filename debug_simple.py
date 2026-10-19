#!/usr/bin/env python3
"""Simpler test of nutrition import to isolate the issue."""

import requests
from backend.recipe_import import extract_nutrition_json_ld, BeautifulSoup

# Test 1: Direct extraction from HTML
test_html = '''
<html>
<head>
<script type="application/ld+json">
{
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "nutrition": {
        "@type": "NutritionInformation",
        "calories": "250 calories"
    }
}
</script>
</head>
<body></body>
</html>
'''

print("=== Testing extract_nutrition_json_ld ===")
result = extract_nutrition_json_ld(test_html)
print(f"Extraction result: {result}")

# Test 2: API import with exact same HTML
BASE_URL = "http://127.0.0.1:8000"

html_content = '''<html>
<head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Recipe","nutrition":{"@type":"NutritionInformation","calories":"250 calories"}}
</script>
</head>
<body></body>
</html>'''

print("\n=== Testing API import ===")
resp = requests.post(
    f"{BASE_URL}/recipes",
    json={
        "name": "Simple Nutrition Test",
        "url": "http://example.com/simple-test-200",
        "instructions_ordered": True,
        "html_content": html_content
    },
    timeout=10
)

print(f"Import status: {resp.status_code}")
result = resp.json()
print(f"Response: {result}")

# Reload and check
import time
time.sleep(0.3)

reload_resp = requests.get(f"{BASE_URL}/recipes/{result['id']}", timeout=5)
reloaded = reload_resp.json()
print(f"After reload: {reloaded}")
print(f"Has nutrition: {'nutrition' in reloaded and reloaded['nutrition']}")
