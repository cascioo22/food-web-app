#!/usr/bin/env python3
"""Simple manual test with debug logging."""

import requests

BASE_URL = "http://127.0.0.1:8000"

# Clear any existing data first
try:
    resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
    if resp.status_code == 200:
        for r in resp.json():
            try:
                requests.delete(f"{BASE_URL}/recipes/{r['id']}", timeout=5)
            except: pass
except:
    pass

try:
    resp = requests.get(f"{BASE_URL}/nutrition", timeout=5)
    if resp.status_code == 200:
        for n in resp.json():
            try:
                requests.delete(f"{BASE_URL}/nutrition/{n['id']}", timeout=5)
            except: pass
except:
    pass

# Test recipe with string-formatted nutrition
html = '''<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Recipe","name":"Test String Nutrition","nutrition":{"@type":"NutritionInformation","calories":"350 calories"}}
</script>
</head><body></body></html>'''

print("\n" + "="*70)
print("Manual Test: Importing recipe with string-formatted nutrition")
print("="*70)

resp = requests.post(
    f"{BASE_URL}/recipes",
    json={
        "name": "Test String Nutrition",
        "url": "http://example.com/test-string-nutrition-001",
        "instructions_ordered": True,
        "html_content": html
    },
    timeout=15
)

print(f"\nImport response status: {resp.status_code}")
if resp.status_code == 201:
    recipe = resp.json()
    print(f"Recipe created: ID={recipe['id']}, Name={recipe['name']}")
    
    # Wait a moment for DB to settle
    import time
    time.sleep(1)
    
    # Reload and check
    reload_resp = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5)
    if reload_resp.status_code == 200:
        reloaded = reload_resp.json()
        print(f"\nReloaded recipe:")
        print(f"  Name: {reloaded['name']}")
        print(f"  Nutrition present: {'nutrition' in reloaded}")
        
        if 'nutrition' in reloaded and reloaded['nutrition']:
            n = reloaded['nutrition']
            print(f"  Nutrition values:")
            for k, v in n.items():
                if v is not None:
                    print(f"    {k}: {v}")
            
            calories = n.get('calories_per_serving') or n.get('calories')
            if calories:
                print(f"\n✓ SUCCESS! Extracted calories: {calories}")
            else:
                print(f"\n✗ ISSUE: No calories found in nutrition")
        else:
            print(f"\n✗ NO NUTRITION SAVED!")
    else:
        print(f"Reload failed with status {reload_resp.status_code}")
else:
    print(f"Import response body (first 500 chars): {resp.text[:500]}")

print("\n" + "="*70)
print("Test complete - check /tmp/uvicorn.log for debug output from app.py")
print("="*70)
