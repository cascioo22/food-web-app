"""Migration script for nutrition data."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, inspect
from sqlalchemy.orm import Session, declarative_base
from sqlalchemy import func
from datetime import datetime, timezone


# Database setup (matches app.py)
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./food_webapp.db"
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)


def migrate():
    """Migrate any existing nutrition data from old schema to new schema."""
    
    # Check current state of recipes table
    inspector = inspect(engine)
    columns = {col["name"]: col for col in inspector.get_columns("recipes", "food_webapp")}
    
    old_nutrition_cols = [
        "calories_per_serving", "protein_per_serving", 
        "carbohydrates_per_serving", "fat_per_serving",
        "fiber_per_serving", "sugar_per_serving", "sodium_per_serving",
        "calories_total", "protein_total", "carbohydrates_total",
        "fat_total", "fiber_total", "sugar_total", "sodium_total"
    ]
    
    has_old_schema = any(col in columns for col in old_nutrition_cols)
    
    if not has_old_schema:
        print("No migration needed - recipes table uses new schema")
        return
    
    print("Found old schema with nutrition columns. Migrating...")
    
    # Create Base class for new schema inspection
    from backend.app_new import Recipe, Nutrition
    
    # First, try to create the new nutrition table if it doesn't exist
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Note: Could not create tables (may already exist): {e}")
    
    with Session(engine) as session:
        # Get all recipes
        recipe_count = session.query(Recipe).count()
        print(f"Found {recipe_count} recipes")
        
        if recipe_count == 0:
            print("No recipes to migrate.")
            return
        
        migrated_count = 0
        
        for recipe in session.query(Recipe).all():
            # Check if this recipe has nutrition data in old schema
            has_nutrition = False
            try:
                calories_per_serving = getattr(recipe, 'calories_per_serving', None)
                if calories_per_serving is not None and calories_per_serving > 0:
                    has_nutrition = True
            except Exception as e:
                # Column doesn't exist in this row
                pass
            
            # Create nutrition record (empty or with data)
            nutrition = Nutrition(recipe_id=recipe.id)
            
            try:
                # Try to copy values if they exist
                if hasattr(recipe, 'calories_per_serving'):
                    nutrition.calories_per_serving = getattr(recipe, 'calories_per_serving')
                if hasattr(recipe, 'protein_per_serving'):
                    nutrition.protein_per_serving = getattr(recipe, 'protein_per_serving')
                if hasattr(recipe, 'carbohydrates_per_serving'):
                    nutrition.carbohydrates_per_serving = getattr(recipe, 'carbohydrates_per_serving')
                if hasattr(recipe, 'fat_per_serving'):
                    nutrition.fat_per_serving = getattr(recipe, 'fat_per_serving')
                if hasattr(recipe, 'fiber_per_serving'):
                    nutrition.fiber_per_serving = getattr(recipe, 'fiber_per_serving')
                if hasattr(recipe, 'sugar_per_serving'):
                    nutrition.sugar_per_serving = getattr(recipe, 'sugar_per_serving')
                if hasattr(recipe, 'sodium_per_serving'):
                    nutrition.sodium_per_serving = getattr(recipe, 'sodium_per_serving')
            except Exception as e:
                pass
            
            session.add(nutrition)
            migrated_count += 1
        
        session.commit()
        
        print(f"Migrated {migrated_count} nutrition records for {recipe_count} recipes.")


if __name__ == "__main__":
    migrate()
