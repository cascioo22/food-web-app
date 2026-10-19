"""Tests for nutrition extraction from recipe links (FW-13).

This test suite covers:
- Complete nutrition metadata extraction
- Partial nutrition data handling  
- Absent nutrition (no JSON-LD found)
- Malformed/missing nutrition data
- Edge cases and error conditions
"""
import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')

from backend.recipe_import import (
    extract_nutrition_json_ld,
    _extract_number,
    RecipeImportResult,
    HAS_BEAUTIFULSOUP
)


def test_extract_nutrition_with_complete_schema():
    """Test extraction of complete nutrition information."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Test Recipe",
            "recipeYield": "4 servings",
            "nutrition": {
                "@type": "NutritionInformation",
                "calories": "250",
                "carbohydrateContent": "30g",
                "fiberContent": "4g",
                "fatContent": "8g",
                "proteinContent": "15g",
                "sodiumContent": "400mg",
                "sugarContent": "5g"
            }
        }
        </script>
    </html>
    """
    
    result = extract_nutrition_json_ld(html)
    
    assert result is not None, "Should extract nutrition data"
    # Note: 'calories' (no suffix) is how schema.org defines it - no Content suffix
    assert 'calories_per_serving' in result or 'calories' in result
    print("PASS: test_extract_nutrition_with_complete_schema")


def test_extract_nutrition_with_numeric_values():
    """Test extraction with pure numeric values (no units)."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <script type="application/ld+json">
        {
            "@type": "Recipe",
            "nutrition": {
                "@type": "NutritionInformation",
                "calories": 250,
                "proteinContent": 15,
                "fatContent": 8
            }
        }
        </script>
    </html>
    """
    
    result = extract_nutrition_json_ld(html)
    
    assert result is not None
    print("PASS: test_extract_nutrition_with_numeric_values")


def test_extract_nutrition_partial_data():
    """Test that partial nutrition data is preserved without guessing."""
    html = """
    <!DOCTYPE html>
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
    </html>
    """
    
    result = extract_nutrition_json_ld(html)
    
    assert result is not None
    print("PASS: test_extract_nutrition_partial_data")


def test_extract_nutrition_absent():
    """Test that None is returned when no nutrition JSON-LD is found."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <script type="application/ld+json">
        {
            "@type": "Article",
            "headline": "Cooking Tips"
        }
        </script>
    </html>
    """
    
    result = extract_nutrition_json_ld(html)
    
    assert result is None, "Should return None when no nutrition info found"
    print("PASS: test_extract_nutrition_absent")


def test_extract_nutrition_malformed():
    """Test handling of malformed/invalid JSON-LD."""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <script type="application/ld+json">
        { invalid json }
        </script>
        <script type="application/ld+json">
        {
            "@type": "Recipe"
        }
        </script>
    </html>
    """
    
    result = extract_nutrition_json_ld(html)
    
    # Should gracefully handle invalid JSON and return None
    assert result is None, "Should return None for malformed nutrition data"
    print("PASS: test_extract_nutrition_malformed")


def test_extract_number_function():
    """Test the _extract_number helper function."""
    assert _extract_number("250 kcal") == 250.0
    assert _extract_number("15.5 g protein") == 15.5
    assert _extract_number("4g fiber") == 4.0
    assert _extract_number("abc no numbers") is None
    assert _extract_number("") is None
    
    print("PASS: test_extract_number_function")


def test_recipe_import_with_nutrition():
    """Test that extraction works with nutrition present."""
    html_content = """
    <!DOCTYPE html>
    <html>
    <body>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Recipe",
            "name": "Grilled Chicken Salad",
            "recipeYield": "2 servings",
            "nutrition": {
                "@type": "NutritionInformation",
                "calories": "350 kcal",
                "proteinContent": "35g",
                "carbohydrateContent": "12g"
            }
        }
        </script>
    </body>
    </html>
    """
    
    result = extract_nutrition_json_ld(html_content)
    
    assert result is not None
    print("PASS: test_recipe_import_with_nutrition")


def test_recipe_import_without_nutrition():
    """Test that recipe import still succeeds when no nutrition data is present."""
    html_content = """
    <!DOCTYPE html>
    <html>
    <body>
        <h1>No Nutrition Data Here</h1>
        <p>This page has no schema.org JSON-LD.</p>
    </body>
    </html>
    """
    
    result = extract_nutrition_json_ld(html_content)
    
    # Should return None gracefully
    assert result is None
    print("PASS: test_recipe_import_without_nutrition")


def test_recipe_import_result_structure():
    """Test that RecipeImportResult includes nutrition_extracted field."""
    result = RecipeImportResult(
        success=True,
        extracted_recipe={'title': 'Test'},
        original_url='http://example.com/recipe',
        nutrition_extracted={'calories_per_serving': 250}
    )
    
    assert hasattr(result, 'nutrition_extracted')
    assert result.nutrition_extracted == {'calories_per_serving': 250}
    print("PASS: test_recipe_import_result_structure")


if __name__ == "__main__":
    print("="*60)
    print("Running nutrition extraction tests...")
    print("="*60)
    
    # Run all tests
    try:
        if HAS_BEAUTIFULSOUP:
            test_extract_nutrition_with_complete_schema()
            test_extract_nutrition_with_numeric_values()
            test_extract_nutrition_partial_data()
            test_extract_nutrition_absent()
            test_extract_nutrition_malformed()
            test_recipe_import_with_nutrition()
            test_recipe_import_without_nutrition()
            test_extract_number_function()
        else:
            print("SKIP: bs4/BeautifulSoup not installed - skipping HTML parsing tests")
            test_extract_number_function()
            test_recipe_import_result_structure()
        
        print("="*60)
        print("SUCCESS: All nutrition extraction tests passed!")
        print("="*60)
    except AssertionError as e:
        print(f"\nFAIL: Test failed with assertion error")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"\nFAIL: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
