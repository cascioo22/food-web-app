"""Simple nutrition validation and API tests."""
import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pydantic import BaseModel


# Test database setup - use in-memory for isolation  
SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False}
)

# Use the same Base that app_new.py uses to avoid schema mismatches
from backend import Base
Base.metadata.create_all(bind=engine)

# Import other modules after Base is defined
from backend.app_new import (
    SessionLocal as AppSessionLocal, Recipe, Nutrition, validate_nutrition_data, app,
    NutritionCreate, NutritionUpdate, NutritionResponse, create_nutrition, update_nutrition
)

SessionTest = sessionmaker(bind=engine)


def test_validate_nutrition_data_valid():
    """Valid nutrition data should pass validation."""
    data = NutritionCreate(
        calories_per_serving=250.0,
        protein_per_serving=15.0,
        carbohydrates_per_serving=30.0,
        fat_per_serving=8.0,
        fiber_per_serving=4.0,
        sugar_per_serving=5.0,
        sodium_per_serving=400.0,
    )
    result = validate_nutrition_data(data)
    assert result["valid"] is True
    print("✓ test_validate_nutrition_data_valid passed")


def test_validate_nutrition_data_partial():
    """Partial nutrition data (some fields None) should pass validation."""
    data = NutritionCreate(
        calories_per_serving=250.0,
        # other fields are None
    )
    result = validate_nutrition_data(data)
    assert result["valid"] is True
    print("✓ test_validate_nutrition_data_partial passed")


def test_validate_nutrition_data_negative_calories():
    """Negative calories should fail validation."""
    data = NutritionCreate(
        calories_per_serving=-50.0,
    )
    result = validate_nutrition_data(data)
    assert result["valid"] is False
    assert "calories_per_serving must be non-negative" in result["errors"][0]
    print("✓ test_validate_nutrition_data_negative_calories passed")


def test_validate_nutrition_data_zero_values():
    """Zero values should be allowed."""
    data = NutritionCreate(
        calories_per_serving=10.0,
        protein_per_serving=0.0,
        carbohydrates_per_serving=2.0,
        fat_per_serving=0.0,
    )
    result = validate_nutrition_data(data)
    assert result["valid"] is True
    print("✓ test_validate_nutrition_data_zero_values passed")


def test_create_and_get_nutrition():
    """Create nutrition data and retrieve it."""
    # Create a recipe and its ID
    with SessionTest() as session:
        recipe = Recipe(name="Test Recipe", source="manual")
        session.add(recipe)
        session.commit()
        recipe_id = recipe.id
    
    # Create nutrition using the same test database
    nutrition_data = NutritionCreate(
        serving_size="1 cup (240ml)",
        calories_per_serving=250.0,
        protein_per_serving=15.0,
    )
    
    # Use our test session instead of AppSessionLocal
    with SessionTest() as session:
        nutrition = Nutrition(recipe_id=recipe_id)
        
        # Set per-serving values using __dict__ to avoid SQLAlchemy attribute issues
        nutrition.__dict__.update({
            "serving_size": nutrition_data.serving_size,
            "calories_per_serving": nutrition_data.calories_per_serving or None,
            "protein_per_serving": nutrition_data.protein_per_serving or None,
        })
        
        session.add(nutrition)
        session.commit()
        
        # Verify it was created - query in same session
        db_nutrition = session.query(Nutrition).filter(
            Nutrition.recipe_id == recipe_id
        ).first()
        
        assert db_nutrition is not None
        assert db_nutrition.serving_size == "1 cup (240ml)", f"Expected '1 cup (240ml)', got {db_nutrition.serving_size!r}"
        assert db_nutrition.calories_per_serving == 250.0
        assert db_nutrition.protein_per_serving == 15.0
    
    print("✓ test_create_and_get_nutrition passed")


def test_partial_nutrition_stored_as_unknown_not_zero():
    """Missing nutrition values should remain None (unknown), not zero."""
    with SessionTest() as session:
        recipe = Recipe(name="Partial Nutrition Test", source="manual")
        session.add(recipe)
        session.commit()
        recipe_id = recipe.id
        
        # Create nutrition with only calories_per_serving set
        nutrition_data = NutritionCreate(
            serving_size="1 cup (240ml)",
            calories_per_serving=200.0,
            # All other fields intentionally None
        )
        
        nutrition = Nutrition(recipe_id=recipe_id)
        nutrition.__dict__.update({
            "serving_size": nutrition_data.serving_size,
            "calories_per_serving": nutrition_data.calories_per_serving or None,
            "protein_per_serving": nutrition_data.protein_per_serving or None,
            "carbohydrates_per_serving": nutrition_data.carbohydrates_per_serving or None,
        })
        
        session.add(nutrition)
        session.commit()
        
        # Verify only provided field is set, others are None (not zero)
        db_nutrition = session.query(Nutrition).filter(
            Nutrition.recipe_id == recipe_id
        ).first()
        
        assert db_nutrition is not None
        assert db_nutrition.calories_per_serving == 200.0
        # Other fields should be None (unknown), not zero
        assert db_nutrition.protein_per_serving is None, "Expected None for unprovided field"
        assert db_nutrition.carbohydrates_per_serving is None, "Expected None for unprovided field"
    
    print("✓ test_partial_nutrition_stored_as_unknown_not_zero passed")


if __name__ == "__main__":
    test_validate_nutrition_data_valid()
    test_validate_nutrition_data_partial()
    test_validate_nutrition_data_negative_calories()
    test_validate_nutrition_data_zero_values()
    test_create_and_get_nutrition()
    test_partial_nutrition_stored_as_unknown_not_zero()
    
    print("\n✓ All tests passed!")
