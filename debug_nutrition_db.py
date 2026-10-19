#!/usr/bin/env python3
"""Debug: Check database records for nutrition."""

import requests
from sqlalchemy import create_engine, select
from backend.app_new import Base, Recipe, Nutrition, engine

BASE_URL = "http://127.0.0.1:8000"

# Get all recipes via API
resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
recipes = resp.json()

print("All recipes:")
for r in recipes:
    status = "WITH NUTRITION" if r.get('nutrition') else "NO NUTRITION"
    print(f"  ID {r['id']}: {r['name']} | URL={bool(r.get('url'))} | Status: {status}")

# Check database directly to see if Nutrition records were created for imported recipes
with engine.connect() as conn:
    result = conn.execute(select([
        'r.id', 'r.name', 'r.url', 'r.source',
        'n.calories_per_serving', 'n.protein_per_serving'
    ]).join(Nutrition, Nutrition.recipe_id == Recipe.id).order_by(Recipe.id)).fetchall()
    
    print("\n" + "=" * 70)
    print("DATABASE: Recipe JOIN Nutrition (ordered by recipe ID)")
    print("=" * 70)
    for row in result:
        has_url = bool(row[2]) if row[2] else False
        url_info = f" URL imported" if has_url else (" MANUAL ENTRY" if row[3] == 'manual_entry' else "")
        calories = row[4] or "NULL"
        protein = row[5] or "NULL"
        print(f"  Recipe ID {row[0]} '{row[1]}'{url_info}")
        print(f"    Source: {row[3]}, Nutrition: calories={calories}, protein={protein}")

print("\n" + "=" * 70)
print("ANALYSIS:")
print("=" * 70)

# Check if any imported recipes (with URL) have nutrition in the database
imported_with_nutrition = []
no_url_with_nutrition = []

for r in recipes:
    has_db_nutrition = any(row[0] == r['id'] and row[4] is not None for row in result) if result else False
    
    if r.get('url') and has_db_nutrition:
        imported_with_nutrition.append(r)
        print(f"✓ Imported recipe '{r['name']}' HAS nutrition in database")
    elif r.get('url') and not has_db_nutrition:
        print(f"✗ Imported recipe '{r['name']}' MISSING nutrition in database (BUG)")
    elif not r.get('url') and r.get('manual_entry') and has_db_nutrition:
        no_url_with_nutrition.append(r)
        print(f"✓ Manual entry recipe '{r['name']}' HAS nutrition")

if not imported_with_nutrition and not no_url_with_nutrition:
    # Check all recipes in database regardless of API response
    for row in result:
        if row[2] is not None:  # has URL
            calories = row[4] or "NULL"
            protein = row[5] or "NULL"
            print(f"? Imported recipe '{row[1]}' - calories={calories}, protein={protein}")
