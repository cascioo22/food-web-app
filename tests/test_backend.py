"""Test suite for Food Webapp backend API and data models."""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="function")
def client_and_db():
    """Create test client and fresh database."""
    import tempfile
    import os
    
    # Import after app is available to get table metadata and app instance
    from app import Base, app, Recipe
    
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    # Create temporary file-based SQLite for testing (more reliable than in-memory)
    with tempfile.NamedTemporaryFile(suffix='.db', delete=True) as tmp:
        test_url = f"sqlite:///{tmp.name}"
        engine = create_engine(test_url, connect_args={"check_same_thread": False})
    
    # CRITICAL: Make sure all tables exist BEFORE any requests are made
    Base.metadata.create_all(bind=engine)
    
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def get_db():
        db = SessionLocalTest()
        print(f"DEBUG get_db: Created session from {db.bind.name}")
        try:
            yield db
        finally:
            db.close()
    
    # Register the dependency override - use get_db from app module since it's defined there
    import app as main_app
    app.dependency_overrides[main_app.get_db] = get_db
    
    with TestClient(app) as c:
        yield c, SessionLocalTest

@pytest.fixture(scope="function")
def sample_recipe(client_and_db):
    """Create a sample recipe for tests."""
    client, session_factory = client_and_db
    
    session = session_factory()
    
    try:
        from app import Recipe
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
        
        yield recipe, client
        
        session.delete(recipe)
        session.commit()
    finally:
        session.close()


def test_root(client_and_db):
    """Test root endpoint."""
    client, _ = client_and_db
    
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"


def test_list_recipes_empty(client_and_db):
    """Test listing recipes when empty."""
    client, session_factory = client_and_db
    
    # Import Recipe here since it's used below
    from app import Recipe
    
    response = client.get("/recipes")
    assert response.status_code == 200
    assert response.json() == []


def test_create_recipe(client_and_db):
    """Test creating a new recipe."""
    client, session_factory = client_and_db
    
    # Import Recipe here since it's used below
    from app import Recipe
    
    payload = {
        "title": "New Recipe",
        "prep_time": "10 min",
        "servings": "4"
    }
    
    response = client.post("/recipes", json=payload)
    print("CREATE RESPONSE:", response.status_code, response.json() if response.status_code != 200 else "OK")
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Recipe"
    assert "id" in data


def test_get_recipe(client_and_db, sample_recipe):
    """Test getting a specific recipe."""
    client, _ = client_and_db
    
    # Get the recipe ID from the sample
    recipe_id = sample_recipe[0].id
    
    response = client.get(f"/recipes/{recipe_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Recipe"


def test_get_recipe_not_found(client_and_db):
    """Test getting non-existent recipe."""
    client, _ = client_and_db
    
    response = client.get("/recipes/9999")
    assert response.status_code == 404


def test_delete_recipe(client_and_db, sample_recipe):
    """Test deleting a recipe."""
    client, _ = client_and_db
    
    # Get the recipe ID from the sample
    recipe_id = sample_recipe[0].id
    
    # Verify recipe exists before delete
    response = client.get(f"/recipes/{recipe_id}")
    assert response.status_code == 200
    
    response = client.delete(f"/recipes/{recipe_id}")
    assert response.status_code == 200
    
    # Verify deletion
    response = client.get(f"/recipes/{recipe_id}")
    assert response.status_code == 404


def test_create_grocery_list(client_and_db):
    """Test creating a grocery list."""
    client, _ = client_and_db
    
    payload = {"name": "My First List"}
    
    response = client.post("/grocery-lists", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My First List"


def test_list_grocery_lists(client_and_db):
    """Test listing grocery lists."""
    client, _ = client_and_db
    
    payload = {"name": "Test List"}
    
    response = client.post("/grocery-lists", json=payload)
    assert response.status_code == 201
    
    response = client.get("/grocery-lists")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1


def test_update_grocery_list(client_and_db):
    """Test updating grocery list items."""
    client, _ = client_and_db
    
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
    client, session_factory = client_and_db
    
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
    client, session_factory = client_and_db
    
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
    client, session_factory = client_and_db
    
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
    from app import Base
    
    # Create in-memory test engine with all tables
    test_url = "sqlite:///:memory:"
    from sqlalchemy import create_engine
    engine = create_engine(test_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    # Check that tables exist
    tables = Base.metadata.tables.keys()
    assert "recipes" in tables
    assert "grocery_lists" in tables
    assert "photos" in tables
