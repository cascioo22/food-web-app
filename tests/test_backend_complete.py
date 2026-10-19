"""Test suite for Food Webapp backend API and data models."""

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import json
import uuid
import datetime as dt
import pytest
from starlette.testclient import TestClient as StarletteTestClient
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base


# Define models (same as app.py for consistency)
Base = declarative_base()

class Recipe(Base):
    __tablename__ = "recipes"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    prep_time = Column(String, default="")
    servings = Column(String, default="")
    category = Column(String, default="")
    original_url = Column(String, nullable=True)
    image_url = Column(String, default="")
    ingredients_text = Column(Text, nullable=True)
    steps_ordered = Column(Text, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

class GroceryList(Base):
    __tablename__ = "grocery_lists"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    items = Column(Text)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

class Photo(Base):
    __tablename__ = "photos"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False, unique=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=True)
    caption = Column(String, default="")
    data_url = Column(Text, nullable=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

class Ingredient(Base):
    __tablename__ = "ingredients"
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(String, default="")
    checked = Column(Boolean, default=False)


def make_test_app_and_db():
    """Create a new FastAPI app instance with fresh in-memory database."""
    import datetime
    from sqlalchemy.orm import Mapped, relationship
    
    test_url = "sqlite:///:memory:"
    engine = create_engine(test_url, connect_args={"check_same_thread": False})
    
    # Create tables for this engine
    Base.metadata.create_all(bind=engine)
    
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def get_db():
        db = SessionLocalTest()
        return db  # Return directly instead of using yield
    
    test_app = FastAPI()
    
    # Root endpoint
    @test_app.get("/")
    async def root(db: Session = None):
        return {"status": "running"}
    
    # Recipes endpoints  
    @test_app.get("/recipes")
    async def list_recipes(skip: int = 0, limit: int = 100, db: Session = None):
        recipes = db.query(Recipe).offset(skip).limit(limit).all()
        return [{"id": r.id, "title": r.title} for r in recipes]
    
    @test_app.post("/recipes", status_code=201)
    async def create_recipe(recipe_data: dict, db: Session = None):
        db_recipe = Recipe(**recipe_data)
        db.add(db_recipe)
        db.commit()
        db.refresh(db_recipe)
        return db_recipe
    
    @test_app.get("/recipes/{recipe_id}")
    async def get_recipe(recipe_id: int, db=Depends(get_db)):
        recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        return recipe
    
    @test_app.delete("/recipes/{recipe_id}")
    async def delete_recipe(recipe_id: int, db=Depends(get_db)):
        recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        db.delete(recipe)
        db.commit()
        return {"message": "Recipe deleted"}
    
    # Ingredients endpoints
    @test_app.post("/recipes/{recipe_id}/ingredients", status_code=201)
    async def add_ingredients(recipe_id: int, ingredient_list: List[dict], db: Session = None):
        db.query(Ingredient).filter(Ingredient.recipe_id == recipe_id).delete()
        new_ingredients = []
        for item in ingredient_list:
            db_ing = Ingredient(recipe_id=recipe_id, **item)
            db.add(db_ing)
            new_ingredients.append(db_ing)
        db.commit()
        return {"created": len(new_ingredients), "items": new_ingredients}
    
    @test_app.get("/recipes/{recipe_id}/ingredients")
    async def get_ingredients(recipe_id: int, db: Session = None):
        return db.query(Ingredient).filter(Ingredient.recipe_id == recipe_id).all()
    
    # Grocery lists endpoints
    @test_app.get("/grocery-lists")
    async def list_grocery_lists(db: Session = None):
        return db.query(GroceryList).all()
    
    @test_app.post("/grocery-lists")
    async def create_grocery_list(list_data: dict, db: Session = None):
        existing = db.query(GroceryList).filter(GroceryList.name == list_data['name']).first()
        if existing:
            raise HTTPException(status_code=400, detail="Grocery list with this name already exists")
        db_list = GroceryList(name=list_data['name'], items='[]')
        db.add(db_list)
        db.commit()
        db.refresh(db_list)
        return db_list
    
    @test_app.patch("/grocery-lists/{list_id}")
    async def update_grocery_list(list_id: int, items_data: List[dict], db: Session = None):
        list_item = db.query(GroceryList).filter(GroceryList.id == list_id).first()
        if not list_item:
            raise HTTPException(status_code=404, detail="Grocery list not found")
        import json
        list_item.items = json.dumps(items_data)
        db.commit()
        return {"message": "Grocery list updated"}
    
    # Photos endpoints
    @test_app.get("/photos")
    async def list_photos(recipe_id: int = None, db: Session = None):
        photos = db.query(Photo).filter(Photo.recipe_id == recipe_id) if recipe_id else db.query(Photo).all()
        return photos
    
    @test_app.post("/photos")
    async def add_photo(photo_data: dict, db: Session = None):
        filename = f"{uuid.uuid4()}.png"
        db_photo = Photo(filename=filename, data_url=photo_data.get("data_url"), recipe_id=photo_data.get("recipe_id"))
        db_photo.caption = photo_data.get("caption", "")
        db.add(db_photo)
        db.commit()
        db.refresh(db_photo)
        return db_photo
    
    @test_app.delete("/photos/{photo_id}")
    async def delete_photo(photo_id: int, db: Session = None):
        photo = db.query(Photo).filter(Photo.id == photo_id).first()
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        db.delete(photo)
        db.commit()
        return {"message": "Photo deleted"}
    
    return test_app, SessionLocalTest


@pytest.fixture(scope="function")
def client_and_db():
    """Create test client with isolated in-memory database for each test."""
    # Create fresh app and DB for each test
    test_app, SessionLocalTest = make_test_app_and_db()
    client = StarletteTestClient(test_app, raise_server_exceptions=True)
    
    yield client, SessionLocalTest


@pytest.fixture(scope="function")
def sample_recipe(client_and_db):
    """Create a sample recipe for tests."""
    client, SessionLocalTest = client_and_db
    
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
    client, _ = client_and_db
    
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"


def test_list_recipes_empty(client_and_db):
    """Test listing recipes when empty."""
    client, _ = client_and_db
    
    response = client.get("/recipes")
    assert response.status_code == 200, f"Got {response.status_code}: {response.text}"
    data = response.json()
    assert len(data) == 0


def test_create_recipe(client_and_db):
    """Test creating a new recipe."""
    client, _ = client_and_db
    
    payload = {
        "title": "New Recipe",
        "prep_time": "10 min",
        "servings": "4"
    }
    
    response = client.post("/recipes", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Recipe"
    assert "id" in data
    
    # Verify it was actually created
    with SessionLocalTest() as session:
        assert session.query(Recipe).count() == 1


def test_get_recipe(client_and_db, sample_recipe):
    """Test getting a specific recipe."""
    client, _ = client_and_db
    
    response = client.get(f"/recipes/{sample_recipe.id}")
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
    
    response = client.delete(f"/recipes/{sample_recipe.id}")
    assert response.status_code == 200
    
    # Verify deletion
    response = client.get(f"/recipes/{sample_recipe.id}")
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
    
    client.post("/grocery-lists", json=payload)
    
    response = client.get("/grocery-lists")
    assert response.status_code == 200


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
    client, _ = client_and_db
    
    # First create a recipe for the photo to belong to
    payload = {"title": "Photo Test Recipe"}
    create_response = client.post("/recipes", json=payload)
    assert create_response.status_code == 201
    recipe_id = create_response.json()["id"]
    
    # Now add photo
    photo_payload = {
        "data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }
    
    response = client.post("/photos", json=photo_payload)
    assert response.status_code == 201


def test_add_ingredients_to_recipe(client_and_db):
    """Test adding ingredients to a recipe."""
    client, _ = client_and_db
    
    # First create a recipe
    payload = {"title": "Ingredients Test Recipe"}
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
    client, _ = client_and_db
    
    # Create recipe and add ingredient
    payload = {"title": "Ingredients Test Recipe"}
    create_response = client.post("/recipes", json=payload)
    assert create_response.status_code == 201
    recipe_id = create_response.json()["id"]
    
    response = client.post(f"/recipes/{recipe_id}/ingredients", 
                         json=[{"name": "Test Ingredient"}])
    
    response = client.get(f"/recipes/{recipe_id}/ingredients")
    assert response.status_code == 200
