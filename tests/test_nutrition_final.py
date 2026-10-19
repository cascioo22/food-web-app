"""Tests for nutrition extraction from recipe links (FW-13)."""
import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')

from backend.recipe_import import extract_nutrition_json_ld, RecipeImportResult, HAS_BEAUTIFULSOUP


def test_complete_nutrition():
    html = """<script type="application/ld+json">{"@type":"Recipe","nutrition":{"@type":"NutritionInformation","calories":250,"fatContent":8,"proteinContent":15}}</script>"""
    result = extract_nutrition_json_ld(html)
    print(f"Complete test: {result}")
    if not result or 'calories' not in result and 'calories_per_serving' not in result:
        sys.exit(1)
    print("PASS")


def test_no_nutrition():
    html = """<script type="application/ld+json">{"@type":"Article","headline":"No nutrition"}</script>"""
    result = extract_nutrition_json_ld(html)
    print(f"No nutrition test: {result}")
    if result is not None:
        sys.exit(1)
    print("PASS")


def test_result_structure():
    result = RecipeImportResult(
        success=True,
        extracted_recipe={'title': 'Test'},
        original_url='http://example.com/recipe',
        nutrition_extracted={'calories_per_serving': 250}
    )
    if not hasattr(result, 'nutrition_extracted') or result.nutrition_extracted != {'calories_per_serving': 250}:
        sys.exit(1)
    print("PASS")


if __name__ == "__main__":
    print("Running nutrition tests...")
    test_complete_nutrition()
    test_no_nutrition()
    test_result_structure()
    print("\nAll passed!")
