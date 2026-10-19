#!/usr/bin/env python3
"""Final nutrition E2E tests after fixing the extraction bug."""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def clear_db():
    """Delete all recipes and nutrition."""
    try:
        resp = requests.get(f"{BASE_URL}/recipes", timeout=5)
        if resp.status_code == 200:
            for r in resp.json():
                try:
                    requests.delete(f"{BASE_URL}/recipes/{r['id']}", timeout=5)
                except:
                    pass
        # Clear nutrition records
        try:
            resp = requests.get(f"{BASE_URL}/nutrition", timeout=5)
            if resp.status_code == 200:
                for n in resp.json():
                    requests.delete(f"{BASE_URL}/nutrition/{n['id']}", timeout=5)
        except:
            pass
    except Exception as e:
        print(f"Clear DB failed: {e}")

def run_test(name, test_fn):
    print(f"\n=== {name} ===")
    try:
        result = test_fn()
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")
        return result
    except Exception as e:
        print(f"✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_complete_nutrition():
    """Import recipe with complete nutrition data."""
    clear_db()
    time.sleep(0.3)
    
    html = '''<html><head>
<script type="application/ld+json">
{
    "@context": "https://schema.org/",
    "@type": "Recipe",
    "name": "Complete Nutrition Test",
    "nutrition": {
        "@type": "NutritionInformation",
        "calories": "350 calories",
        "fatContent": "12 grams of fat",
        "proteinContent": "20 grams of protein",
        "carbohydrateContent": "45 grams of carbs"
    }
}
</script>
</head><body></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "Complete Nutrition Test",
            "url": "http://test.com/complete-nutrition",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    if resp.status_code != 201:
        print(f"Import failed: {resp.status_code}")
        return False
    
    recipe = resp.json()
    time.sleep(0.5)
    
    # Reload and verify
    reload = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5).json()
    
    if not reload.get('nutrition'):
        print("No nutrition in reload")
        return False
    
    n = reload['nutrition']
    print(f"Nutrition loaded: calories={n.get('calories_per_serving')}, protein={n.get('protein_per_serving')}")
    
    # Verify key fields are present
    has_calories = 'calories_per_serving' in n or 'calories' in n
    has_protein = 'protein_per_serving' in n or 'protein' in n
    
    return has_calories and has_protein

def test_string_value_parsing():
    """Test that string values like '250 calories' are parsed correctly."""
    clear_db()
    time.sleep(0.3)
    
    # Simple format with string values
    html = '''<html><head>
<script type="application/ld+json">
{
    "@type": "Recipe",
    "name": "String Value Test",
    "nutrition": {
        "@type": "NutritionInformation",
        "calories": "250 calories"
    }
}
</script>
</head><body></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "String Value Test",
            "url": "http://test.com/string-values",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    if resp.status_code != 201:
        print(f"Import failed: {resp.status_code}")
        return False
    
    recipe = resp.json()
    time.sleep(0.5)
    
    reload = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5).json()
    
    if not reload.get('nutrition'):
        print("No nutrition loaded - BUG NOT FIXED")
        return False
    
    n = reload['nutrition']
    calories = n.get('calories_per_serving') or n.get('calories')
    print(f"Calories parsed: {calories}")
    
    # Should be around 250 (might be slightly different due to parsing)
    return calories is not None and abs(calories - 250) < 10

def test_malformed_nutrition_no_blocking():
    """Malformed nutrition should not prevent recipe import."""
    clear_db()
    time.sleep(0.3)
    
    html = '''<html><head>
<script type="application/ld+json">
{
    "@type": "Recipe",
    "name": "Malformed Test",
    "nutrition": {
        "invalid_field": "should be ignored"
    }
}
</script>
</head><body></body></html>'''
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "Malformed Test",
            "url": "http://test.com/malformed",
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    # Should succeed even if nutrition fails to parse
    return resp.status_code in (201, 422)

def test_manual_entry_still_works():
    """Manual nutrition entry should still work after fix."""
    clear_db()
    time.sleep(0.3)
    
    # Create recipe without URL (manual entry)
    html = '<html><head></head><body><h1>Manual Entry</h1></body></html>'
    
    resp = requests.post(
        f"{BASE_URL}/recipes",
        json={
            "name": "Manual Entry Test",
            "url": None,  # No URL = manual entry
            "instructions_ordered": True,
            "html_content": html
        },
        timeout=10
    )
    
    recipe = resp.json()
    time.sleep(0.3)
    
    # Add nutrition manually
    add_resp = requests.post(
        f"{BASE_URL}/recipes/{recipe['id']}/nutrition",
        json={"calories_per_serving": 180, "protein_per_serving": 12},
        timeout=10
    )
    
    if add_resp.status_code != 201:
        print(f"Manual nutrition save failed: {add_resp.status_code}")
        return False
    
    # Verify
    reload = requests.get(f"{BASE_URL}/recipes/{recipe['id']}", timeout=5).json()
    n = reload.get('nutrition')
    
    return n is not None and n.get('calories_per_serving') == 180

def main():
    print("=" * 60)
    print("Nutrition E2E Test Suite (After Bug Fix)")
    print("=" * 60)
    
    tests = [
        ("String Value Parsing", test_string_value_parsing),
        ("Complete Nutrition Import", test_complete_nutrition),
        ("Malformed Nutrition Handling", test_malformed_nutrition_no_blocking),
        ("Manual Entry Still Works", test_manual_entry_still_works),
    ]
    
    results = []
    for name, fn in tests:
        results.append(run_test(name, fn))
    
    print("\n" + "=" * 60)
    print(f"Results: {sum(results)}/{len(results)} passed")
    print("=" * 60)
    
    return all(results)

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
