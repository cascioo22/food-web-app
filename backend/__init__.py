"""Backend package exports."""

# Don't import app here - it would cause circular imports in tests
# Import directly from backend.app when needed.

from pydantic import BaseModel
from typing import List, Optional

__all__ = [
    "BaseModel",
    "List", 
    "Optional",
    "SessionLocal",
    "Base",  # Re-export to avoid circular imports in tests
    "Recipe",
    "Nutrition",
    "get_db",
    "validate_nutrition_data",
    "migrate_existing_nutrition",
    "create_nutrition",
    "update_nutrition",
    "delete_nutrition",
    "NutritionCreate",
    "NutritionUpdate",
    "NutritionResponse",
    "RecipeResponse",
]

# Re-export Base for testing
from backend.app_new import Base as exported_Base
Base = exported_Base
