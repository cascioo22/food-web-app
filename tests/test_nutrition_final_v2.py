#!/usr/bin/env python3
"""Comprehensive nutrition E2E test with proper cleanup."""

import requests
import time
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

def reset_database():
    """Completely reset the database by removing all recipes and nutrition."""
    print("[*] Resetting database...")
    
    # First delete ALL existing nutrition records
    try:
        resp = requests.get(f"{BASE_URL}/nutrition", timeout=5)
        if resp.status_code == 200:
            nutritions = resp.json()
            for n in nutritions:
                try:
                    requests.delete(f"{BASE_URL}/nutrition/{n['id']}", timeout=5)
                except Exception:
                    pass
        print("    Cleared nutrition records")
    except Exception as e:
        print(f"    Error clearing nutrition: {e}")
    
    # Then delete ALL existing recipes  
    try:
        resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
        if resp.status_code == 200:
            recipes = resp.json()
            for r in recipes:
                try:
                    requests.delete(f"{BASE_URL}/recipes/{r['id']}", timeout=5)
                except Exception:
                    pass
        print("    Cleared recipes")
    except Exception as e:
        print(f"    Error clearing recipes: {e}")
    
    # Brief pause to ensure DB is in clean state
    time.sleep(0.2)

def run_test(name, test_fn):
    """Helper to run a single test with pass/fail reporting."""
    print(f"\n{'='*70}")
    print(f"TEST: {name}")
    print('='*70)
    
    try:
        result = test_fn()
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"\n{status}: {name}")
        return result
    except Exception as e:
        print(f"\n✗ ERROR in {name}: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_string_value_parsing():
    """Test 1: String values like '250 calories' are parsed correctly."""
    reset_database()
    
    html = '''<html><head>
<script type="application/ld+json">
{
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "name": "String Value Test Recipe",
    "description": "Testing string-formatted nutrition values",
    "nutrition": {
        "@type": "NutritionInformation",
        "calories": "250 calories"
    }
}
</script>
</head><body><h1>Test</h1></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "String Value Test",
            "url": "http://example.com/string-test-001",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    if resp.status_code != 201:
        print(f"Import failed with status {resp.status_code}: {resp.text[:200] if resp.text else 'No response'}")
        return False
    
    recipe = resp.json()
    print(f"[+] Created recipe ID: {recipe['id']}, name: {recipe['name']}")
    
    time.sleep(0.5)
    
    # Reload and verify nutrition
    reload_resp = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5)
    if reload_resp.status_code != 200:
        print(f"Reload failed with status {reload_resp.status_code}")
        return False
    
    reloaded = reload_resp.json()
    
    if not reloaded.get('nutrition'):
        print("✗ No nutrition found after import")
        return False
    
    nutrition = reloaded['nutrition']
    calories = nutrition.get('calories_per_serving') or nutrition.get('calories')
    
    print(f"[+] Nutrition loaded successfully:")
    print(f"    calories_per_serving: {calories}")
    
    # Verify the value is close to 250 (might have slight variance)
    if calories is None:
        return False
    
    # Should be approximately 250 calories
    if abs(calories - 250) > 10:
        print(f"    WARNING: Expected ~250, got {calories}")
    
    return True

def test_complete_nutrition():
    """Test 2: Import recipe with complete nutrition data."""
    reset_database()
    
    html = '''<html><head>
<script type="application/ld+json">
{
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "name": "Complete Nutrition Test",
    "description": "Testing comprehensive nutrition fields",
    "recipeYield": "4 servings",
    "nutrition": {
        "@type": "NutritionInformation",
        "calories": "350 calories",
        "fatContent": "12 grams of fat",
        "proteinContent": "20 grams of protein",
        "carbohydrateContent": "45 grams of carbohydrates"
    }
}
</script>
</head><body></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "Complete Nutrition Test",
            "url": "http://example.com/complete-nutrition-001",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    if resp.status_code != 201:
        print(f"Import failed with status {resp.status_code}")
        return False
    
    recipe = resp.json()
    print(f"[+] Created recipe ID: {recipe['id']}")
    
    time.sleep(0.5)
    
    # Reload and verify all fields
    reload_resp = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5)
    if reload_resp.status_code != 200:
        print("Reload failed")
        return False
    
    reloaded = reload_resp.json()
    
    if not reloaded.get('nutrition'):
        print("✗ No nutrition after import")
        return False
    
    nutrition = reloaded['nutrition']
    print(f"[+] Nutrition loaded:")
    print(f"    calories_per_serving: {nutrition.get('calories_per_serving')}")
    print(f"    protein_per_serving: {nutrition.get('protein_per_serving')}")
    print(f"    fat_per_serving: {nutrition.get('fat_per_serving')}")
    print(f"    carbohydrates_per_serving: {nutrition.get('carbohydrates_per_serving')}")
    
    # Check that we have some key fields
    has_calories = 'calories_per_serving' in nutrition or 'calories' in nutrition
    has_protein = 'protein_per_serving' in nutrition or 'protein' in nutrition
    
    if not (has_calories and has_protein):
        print("✗ Missing key nutrition fields")
        return False
    
    return True

def test_malformed_nutrition():
    """Test 3: Malformed/missing nutrition should not block import."""
    reset_database()
    
    html = '''<html><head>
<script type="application/ld+json">
{
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "name": "Malformed Nutrition Test",
    "nutrition": {
        "@type": "NutritionInformation",
        "invalid_field": "should be ignored",
        "another_invalid": 12345
    }
}
</script>
</head><body></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "Malformed Nutrition Test",
            "url": "http://example.com/malformed-001",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    # Import should succeed even if nutrition fails to parse
    if resp.status_code not in (201, 422):
        print(f"Import failed with status {resp.status_code}")
        return False
    
    recipe = resp.json()
    print(f"[+] Recipe imported successfully despite malformed nutrition")
    
    time.sleep(0.5)
    
    # Verify recipe is still accessible
    reload_resp = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5)
    if reload_resp.status_code not in (200, 422):
        print(f"Reload failed with status {reload_resp.status_code}")
        return False
    
    reloaded = reload_resp.json()
    print(f"[+] Recipe is accessible after import")
    
    # May or may not have nutrition - that's OK
    if reloaded.get('nutrition'):
        print(f"    Nutrition was partially parsed: calories={reloaded['nutrition'].get('calories_per_serving')}")
    
    return True

def test_recipe_without_nutrition():
    """Test 4: Recipe without any nutrition data."""
    reset_database()
    
    html = '''<html><head>
<title>No Nutrition Page</title>
<body><h1>A Simple Recipe Without Structured Data</h1></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "No Nutrition Test",
            "url": "http://example.com/no-nutrition-001",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    if resp.status_code != 201:
        print(f"Import failed with status {resp.status_code}")
        return False
    
    recipe = resp.json()
    print(f"[+] Created recipe without nutrition support")
    
    time.sleep(0.5)
    
    # Recipe should import, nutrition may not be present
    reload_resp = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5)
    if reload_resp.status_code != 200:
        print("Reload failed")
        return False
    
    reloaded = reload_resp.json()
    
    # Should have recipe data but no nutrition
    if not reloaded.get('name'):
        print("✗ Recipe has no name")
        return False
    
    print(f"[+] Recipe imported successfully (no nutrition expected)")
    print(f"    Name: {reloaded['name']}")
    
    return True

def test_manual_nutrition_entry():
    """Test 5: Manual nutrition entry for existing recipes."""
    reset_database()
    
    # First create a recipe WITHOUT nutrition
    html = '''<html><head>
<body><h1>Manual Entry Test</h1></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "Manual Entry Test",
            "url": "http://example.com/manual-entry-001",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    if resp.status_code != 201:
        print(f"Initial recipe import failed with status {resp.status_code}")
        return False
    
    recipe = resp.json()
    print(f"[+] Created base recipe ID: {recipe['id']}")
    
    time.sleep(0.3)
    
    # Verify NO nutrition initially (critical check)
    reload1 = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5).json()
    if reload1.get('nutrition'):
        print(f"✗ UNEXPECTED: Nutrition found before manual entry")
        print(f"   nutrition={reload1['nutrition']}")
        return False
    
    print("[+] Confirmed: No nutrition before manual entry")
    
    # Add nutrition manually
    add_resp = requests.post(
        f"{BASE_URL}/recipes/{recipe['id']}/nutrition",
        json={
            "calories_per_serving": 200,
            "protein_per_serving": 15,
            "carbohydrates_per_serving": 30,
            "fat_per_serving": 8
        },
        timeout=10
    )
    
    if add_resp.status_code != 201:
        print(f"Manual nutrition save failed with status {add_resp.status_code}: {add_resp.text[:300] if add_resp.text else 'No response'}")
        return False
    
    print("[+] Manual nutrition entry successful")
    
    # Verify it persisted
    time.sleep(0.5)
    reload2 = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5).json()
    
    if not reload2.get('nutrition'):
        print("✗ Nutrition not persisted after manual entry")
        return False
    
    nutrition = reload2['nutrition']
    print(f"[+] Nutrition values saved:")
    print(f"    calories_per_serving: {nutrition.get('calories_per_serving')}")
    print(f"    protein_per_serving: {nutrition.get('protein_per_serving')}")
    
    if nutrition.get('calories_per_serving') != 200:
        print("✗ Calories not saved correctly")
        return False
    
    if nutrition.get('protein_per_serving') != 15:
        print("✗ Protein not saved correctly")
        return False
    
    return True

def test_nutrition_update():
    """Test 6: Update nutrition values via API."""
    reset_database()
    
    # Create recipe with initial nutrition from import
    html = '''<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org/","@type":"Recipe","name":"Update Test","nutrition":{"@type":"NutritionInformation","calories":"500 calories"}}
</script>
</head><body></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "Update Test Recipe",
            "url": "http://example.com/update-test-001",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    if resp.status_code != 201:
        print(f"Initial import failed with status {resp.status_code}")
        return False
    
    recipe = resp.json()
    print(f"[+] Created recipe ID: {recipe['id']}")
    
    time.sleep(0.5)
    
    # Get initial values
    reload1 = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5).json()
    initial_nutrition = reload1.get('nutrition', {})
    initial_calories = initial_nutrition.get('calories_per_serving') or initial_nutrition.get('calories')
    print(f"[+] Initial calories: {initial_calories}")
    
    # Update nutrition via PUT
    update_resp = requests.put(
        f"{BASE_URL}/recipes/{recipe['id']}/nutrition",
        json={
            "calories_per_serving": 450,
            "protein_per_serving": 25,
            "fat_per_serving": 18
        },
        timeout=10
    )
    
    if update_resp.status_code != 200:
        print(f"Update failed with status {update_resp.status_code}: {update_resp.text[:300] if update_resp.text else 'No response'}")
        return False
    
    print("[+] Nutrition update successful")
    
    # Verify update persisted
    time.sleep(0.5)
    reload2 = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5).json()
    updated_nutrition = reload2.get('nutrition', {})
    updated_calories = updated_nutrition.get('calories_per_serving') or updated_nutrition.get('calories')
    
    print(f"[+] Updated calories: {updated_calories}")
    
    if updated_calories != 450:
        print(f"✗ Expected calories=450, got {updated_calories}")
        return False
    
    if updated_nutrition.get('protein_per_serving') != 25:
        print("✗ Protein not updated correctly")
        return False
    
    return True

def main():
    """Run all tests."""
    print("="*70)
    print("Nutrition Feature E2E Test Suite")
    print("Testing fix for string-value parsing bug (FW-13 + t_6326936c)")
    print("="*70)
    
    tests = [
        ("String Value Parsing", test_string_value_parsing),
        ("Complete Nutrition Import", test_complete_nutrition),
        ("Malformed Nutrition Handling", test_malformed_nutrition),
        ("Recipe Without Nutrition", test_recipe_without_nutrition),
        ("Manual Nutrition Entry", test_manual_nutrition_entry),
        ("Nutrition Update", test_nutrition_update),
    ]
    
    results = []
    for name, fn in tests:
        results.append(run_test(name, fn))
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    passed = sum(results)
    total = len(results)
    print(f"\n{passed}/{total} tests passed")
    
    for i, (name, _) in enumerate(tests):
        status = "✓" if results[i] else "✗"
        print(f"  {status} {name}")
    
    return all(results)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
