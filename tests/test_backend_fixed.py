"""Test suite for Food Webapp backend API and data models."""

from app import Recipe, GroceryList, Photo, Ingredient, Base, get_db, app
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


def setup_in_memory_db():
    """Create fresh in-memory database and return SessionLocal."""
    test_url = "sqlite:///:memory:"
    engine = create_engine(test_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def override_get_db():
        return SessionLocalTest()
    
    original_get_db = get_db
    app.dependency_overrides[get_db] = override_get_db
    
    return SessionLocalTest, engine


@pytest.fixture(scope="function")
def client_and_db():
    """Create test client and fresh database."""
    from app import Base, SessionLocal, get_db, app
    
    # Create a new in-memory DB for each test function
    SessionLocalTest, engine = setup_in_memory_db()
    
    class TestSession:
        def __init__(self):
            self.session_factory = lambda: SessionLocalTest()
    
    def override_get_db():
        return SessionLocalTest()
    
    original_get_db = app.dependency_overrides[get_db]
    try:
        app.dependency_overrides[get_db] = override_get_db
        
        with TestClient(app) as c:
            yield c, SessionLocalTest, engine
    finally:
        app.dependency_overrides[get_db] = original_get_db


@pytest.fixture(scope="function")
def sample_recipe(client_and_db):
    """Create a sample recipe for tests."""
    client, SessionLocalTest, _ = client_and_db
    
    with SessionLocalTest() as session:
        recipe = Recipe(
            title="Test Recipe",
            prep_time="15 min",
            servings="2",
            category="lunch",
            original_url="https://example.com/recipe"
        )
        session.add(recipe)
        session.commit()
        session.refresh(recipe)
        
        yield recipe
        
        session.delete(recipe)
        session.commit()


def test_root(client_and_db):
    """Test root endpoint."""
    client, _, _ = client_and_db
    
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"


def test_list_recipes_empty(client_and_db):
    """Test listing recipes when empty."""
    client, SessionLocalTest, _ = client_and_db
    
    with SessionLocalTest() as session:
        # Verify database is empty before listing
        assert session.query(Recipe).count() == 0
        
    response = client.get("/recipes")
    assert response.status_code == 200
    assert response.json() == []


def test_create_recipe(client_and_db):
    """Test creating a new recipe."""
    client, SessionLocalTest, _ = client_and_db
    
    payload = {
        "title": "New Recipe",
        "prep_time": "10 min",
        "servings": "4"
    }
    
    with SessionLocalTest() as session:
        # Verify database is empty before creating
        assert session.query(Recipe).count() == 0
        
    response = client.post("/recipes", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Recipe"
    assert "id" in data


def test_get_recipe(client_and_db, sample_recipe):
    """Test getting a specific recipe."""
    client, _, _ = client_and_db
    
    response = client.get(f"/recipes/{sample_recipe.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Recipe"


def test_get_recipe_not_found(client_and_db):
    """Test getting non-existent recipe."""
    client, _, _ = client_and_db
    
    response = client.get("/recipes/9999")
    assert response.status_code == 404


def test_delete_recipe(client_and_db, sample_recipe):
    """Test deleting a recipe."""
    client, SessionLocalTest, _ = client_and_db
    
    with SessionLocalTest() as session:
        # Verify recipe exists before delete
        assert session.query(Recipe).count() >= 1
        
        response = client.delete(f"/recipes/{sample_recipe.id}")
        assert response.status_code == 200
        
        # Verify deletion
        response = client.get(f"/recipes/{sample_recipe.id}")
        assert response.status_code == 404


def test_create_grocery_list(client_and_db):
    """Test creating a grocery list."""
    client, SessionLocalTest, _ = client_and_db
    
    payload = {"name": "My First List"}
    
    with SessionLocalTest() as session:
        assert session.query(GroceryList).count() == 0
        
        response = client.post("/grocery-lists", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My First List"


def test_list_grocery_lists(client_and_db):
    """Test listing grocery lists."""
    client, SessionLocalTest, _ = client_and_db
    
    payload = {"name": "Test List"}
    
    with SessionLocalTest() as session:
        assert session.query(GroceryList).count() == 0
        
        client.post("/grocery-lists", json=payload)
        
        response = client.get("/grocery-lists")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1


def test_update_grocery_list(client_and_db):
    """Test updating grocery list items."""
    client, _, _ = client_and_db
    
    # Create list first
    create_response = client.post("/grocery-lists", json={"name": "Update Test"})
    assert create_response.status_code == 201
    list_id = create_response.json()["id"]
    
    # Update items
    response = client.patch(f"/grocery-lists/{list_id}", 
                          json=[{"name": "Eggs", "amount": "6", "checked": False}])
    assert response.status_code == 200


def test_create_photo(client_and_db):
    """Test adding a photo."""
    client, _, _ = client_and_db
    
    # First create a recipe for the photo to belong to
    payload = {"title": "Photo Test Recipe"}
    create_response = client.post("/recipes", json=payload)
    assert create_response.status_code == 201
    recipe_id = create_response.json()["id"]
    
    # Now add photo
    photo_payload = {
        "filename": "test-photo.png",
        "recipe_id": recipe_id,
        "caption": "Test photo",
        "data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }
    
    response = client.post("/photos", json=photo_payload)
    assert response.status_code == 201


def test_add_ingredients_to_recipe(client_and_db):
    """Test adding ingredients to a recipe."""
    client, _, _ = client_and_db
    
    # First create a recipe with ID 1 for testing
    payload = {
        "title": "Ingredients Test Recipe"
    }
    create_response = client.post("/recipes", json=payload)
    assert create_response.status_code == 201
    recipe_id = create_response.json()["id"]
    
    # Add ingredients
    ingredients = [
        {"name": "Flour", "amount": "2 cups", "checked": False},
        {"name": "Salt", "amount": "1 tsp", "checked": True}
    ]
    
    response = client.post(f"/recipes/{recipe_id}/ingredients", json=ingredients)
    assert response.status_code == 201


def test_get_ingredients(client_and_db):
    """Test getting ingredients for a recipe."""
    client, _, _ = client_and_db
    
    # Create recipe and add ingredient
    payload = {"title": "Ingredients Test Recipe"}
    create_response = client.post("/recipes", json=payload)
    assert create_response.status_code == 201
    recipe_id = create_response.json()["id"]
    
    response = client.post(f"/recipes/{recipe_id}/ingredients", 
                         json=[{"name": "Test Ingredient"}])
    
    response = client.get(f"/recipes/{recipe_id}/ingredients")
    assert response.status_code == 200


def test_database_models():
    """Test database model definitions."""
    SessionLocalTest, engine = setup_in_memory_db()
    
    with SessionLocalTest() as session:
        # Check that tables exist
        tables = Base.metadata.tables.keys()
        assert "recipes" in tables
        assert "grocery_lists" in tables
        assert "photos" in tables
        
        # Test model creation
        recipe = Recipe(title="Model Test")
        session.add(recipe)
        session.commit()
        
        # Verify data was saved
        retrieved = session.query(Recipe).filter_by(title="Model Test").first()
        assert retrieved is not None
