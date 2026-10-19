#!/usr/bin/env python3
"""Debug manual nutrition entry issue."""

import requests

BASE_URL = "http://127.0.0.1:8000"

print("Checking current state before test...")
resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
if resp.status_code == 200:
    print(f"\nCurrent recipes: {len(resp.json())}")
    for r in resp.json():
        n = r.get('nutrition')
        status = "WITH NUTRITION" if n else "NO NUTRITION"
        print(f"  ID {r['id']}: {r['name']} - {status}")

resp2 = requests.get(f"{BASE_URL}/nutrition", timeout=5)
if resp2.status_code == 200:
    print(f"\nNutrition records: {len(resp2.json())}")
    for n in resp2.json():
        print(f"  ID {n['id']}: recipe_id={n.get('recipe_id')}, calories={n.get('calories_per_serving')}")
