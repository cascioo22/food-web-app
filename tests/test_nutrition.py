"""Tests for nutrition storage and API."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import schemas locally after loading backend modules to avoid circular imports
from pydantic import BaseModel


# Import other modules first, then import our custom types from app_new
# This avoids the circular import issue with FastAPI TestClient
import sys
sys.path.insert(0, '/opt/data/home/food-webapp-project')

# Now we can import from backend - this loads the database setup and models
from backend.app_new import (
    SessionLocal, Recipe, Nutrition, validate_nutrition_data, app,
)


# Import Pydantic schemas after backend is loaded
from backend.app_new import NutritionCreate, NutritionUpdate, NutritionResponse, create_nutrition, update_nutrition

# Test database setup
SQLALCHEMY_TEST_URL = "sqlite:///./test_food_webapp.db"
engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False}
)
SessionTest = sessionmaker(bind=engine)

