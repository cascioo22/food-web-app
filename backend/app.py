"""Food Webapp FastAPI backend with recipe and nutrition support."""
from fastapi import FastAPI, Depends, HTTPException, status, File, Form, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, TYPE_CHECKING
from contextlib import contextmanager

if TYPE_CHECKING:
    from pydantic.main import BaseModel

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, func, Boolean, select
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

import sys
import os
import base64

# Add the project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Constants
PHOTO_UPLOAD_DIR = os.getenv("PHOTO_UPLOAD_DIR", "/app/uploads/photos")

# Database setup
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./food_webapp.db"
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)

SessionLocal = lambda: Session(engine)

Base = declarative_base()

# Database Models
class Recipe(Base):
    """Recipe model."""
    __tablename__ = "recipes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(500), nullable=False)
    url = Column(String(1024), nullable=True)
    manual_entry = Column(Text, nullable=True)
    source = Column(String(100), default="manual")  # "import", "manual"
    original_url = Column(String(1024), nullable=True)
    instructions_ordered = Column(Boolean, default=False)
    ingredients_text = Column(Text, default="")
    steps_ordered = Column(Text, default="")
    prep_time = Column(String(200), default="")
    servings = Column(String(200), default="")
    category = Column(String(200), default="")

    @property
    def title(self):
        return self.name
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Nutrition(Base):
    """Nutrition information model - separate table for flexibility."""
    __tablename__ = "nutrition"
    
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, unique=True)
    serving_size = Column(String(200), nullable=True)  # e.g., "1 cup (240ml)"
    
    # Per-serving values (can be None for partial data)
    calories_per_serving = Column(Float, default=None)
    protein_per_serving = Column(Float, default=None)
    carbohydrates_per_serving = Column(Float, default=None)
    fat_per_serving = Column(Float, default=None)
    fiber_per_serving = Column(Float, default=None)
    sugar_per_serving = Column(Float, default=None)
    sodium_per_serving = Column(Float, default=None)
    
    # Total recipe values (can be None for partial data)
    calories_total = Column(Float, default=None)
    protein_total = Column(Float, default=None)
    carbohydrates_total = Column(Float, default=None)
    fat_total = Column(Float, default=None)
    fiber_total = Column(Float, default=None)
    sugar_total = Column(Float, default=None)
    sodium_total = Column(Float, default=None)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Photo(Base):
    """Finished food photo model - associated with recipes optionally."""
    __tablename__ = "photos"
    
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(255), nullable=False)
    thumbnail_filename = Column(String(255), nullable=True)
    caption = Column(String(1000), nullable=True)
    file_size_bytes = Column(Integer, default=0)
    format = Column(String(20), default="jpeg")
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class GroceryList(Base):
    __tablename__ = "grocery_lists"
    id = Column(Integer, primary_key=True)
    name = Column(String(500), nullable=False)


class GroceryItem(Base):
    __tablename__ = "grocery_items"
    id = Column(Integer, primary_key=True)
    list_id = Column(Integer, ForeignKey("grocery_lists.id"), nullable=False)
    name = Column(String(1000), nullable=False)
    completed = Column(Boolean, default=False)


def get_db():
    """Dependency for getting database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic schemas
class NutritionCreate(BaseModel):
    """Schema for creating nutrition data (all fields optional)."""
    serving_size: Optional[str] = None
    calories_per_serving: Optional[float] = None
    protein_per_serving: Optional[float] = None
    carbohydrates_per_serving: Optional[float] = None
    fat_per_serving: Optional[float] = None
    fiber_per_serving: Optional[float] = None
    sugar_per_serving: Optional[float] = None
    sodium_per_serving: Optional[float] = None
    calories_total: Optional[float] = None
    protein_total: Optional[float] = None
    carbohydrates_total: Optional[float] = None
    fat_total: Optional[float] = None
    fiber_total: Optional[float] = None
    sugar_total: Optional[float] = None
    sodium_total: Optional[float] = None


class NutritionUpdate(BaseModel):
    """Schema for updating nutrition data (partial update)."""
    serving_size: Optional[str] = None
    calories_per_serving: Optional[float] = None
    protein_per_serving: Optional[float] = None
    carbohydrates_per_serving: Optional[float] = None
    fat_per_serving: Optional[float] = None
    fiber_per_serving: Optional[float] = None
    sugar_per_serving: Optional[float] = None
    sodium_per_serving: Optional[float] = None
    calories_total: Optional[float] = None
    protein_total: Optional[float] = None
    carbohydrates_total: Optional[float] = None
    fat_total: Optional[float] = None
    fiber_total: Optional[float] = None
    sugar_total: Optional[float] = None
    sodium_total: Optional[float] = None


class NutritionResponse(BaseModel):
    """Schema for nutrition data response."""
    id: int
    recipe_id: int
    serving_size: Optional[str]
    
    # Per-serving values
    calories_per_serving: Optional[float]
    protein_per_serving: Optional[float]
    carbohydrates_per_serving: Optional[float]
    fat_per_serving: Optional[float]
    fiber_per_serving: Optional[float]
    sugar_per_serving: Optional[float]
    sodium_per_serving: Optional[float]
    
    # Total values
    calories_total: Optional[float]
    protein_total: Optional[float]
    carbohydrates_total: Optional[float]
    fat_total: Optional[float]
    fiber_total: Optional[float]
    sugar_total: Optional[float]
    sodium_total: Optional[float]
    
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class RecipeResponse(BaseModel):
    """Schema for recipe response."""
    id: int
    name: str
    title: str
    ingredients_text: str = ""
    steps_ordered: str = ""
    prep_time: str = ""
    servings: str = ""
    category: str = ""
    url: Optional[str]
    manual_entry: Optional[str]
    source: str
    original_url: Optional[str]
    instructions_ordered: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    # Include nutrition if available
    nutrition: Optional[NutritionResponse] = None
    
    class Config:
        from_attributes = True


# Ingredient model for structured storage (used in FW-10 bulk add)
class IngredientModel(Base):
    """Structured ingredient with id, recipe_id, name, amount, checked."""
    __tablename__ = "ingredients"
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(String, default="")
    checked = Column(Boolean, default=False)


class GroceryListCreate(BaseModel):
    """Schema for creating a grocery list."""
    name: str


class RecipeIngredientsRequest(BaseModel):
    """Schema for requesting ingredients to add from a recipe."""
    recipe_id: int
    grocery_list_id: int
    ingredient_ids: list[int]  # List of ingredient IDs to add (all if empty)


class BulkAddResult(BaseModel):
    """Schema for bulk add response."""
    success: bool
    added_count: int
    skipped_duplicates: int
    items_added: list['PydanticIngredient']
    warning: Optional[str] = None


class PydanticIngredient(BaseModel):
    """Pydantic model for ingredient in API responses."""
    id: int
    recipe_id: int
    name: str
    amount: str
    checked: bool


def parse_ingredients_text(text: str) -> list[dict]:
    """
    Parse ingredients text (newline-separated) into structured ingredient objects.
    
    Args:
        text: Ingredients text with one item per line, e.g.:
               "2 cups flour
                3 large eggs
                1 tsp salt"
    
    Returns:
        List of dicts with 'name', 'amount' keys
    """
    if not text or not text.strip():
        return []
    
    ingredients = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        # Simple parsing: assume first word is name, rest is amount
        parts = line.split(None, 1)  # Split on whitespace, max 2 parts
        if parts:
            ingredient = {
                "name": parts[0],
                "amount": parts[1].strip() if len(parts) > 1 else ""
            }
            ingredients.append(ingredient)
    
    return ingredients


def normalize_ingredient_name(name: str) -> str:
    """Normalize ingredient name for comparison (case-insensitive, trimmed)."""
    return name.lower().strip()


def can_merge_items(item1: dict, item2: dict) -> bool:
    """
    Determine if two items can be merged.
    
    Items can merge if they have compatible units (both empty or both non-empty and matching).
    For simplicity, we compare the amount field directly.
    """
    name1 = normalize_ingredient_name(item1.get("name", ""))
    name2 = normalize_ingredient_name(item2.get("name", ""))
    
    # Different ingredient names - cannot merge
    if name1 != name2:
        return False
    
    amount1 = item1.get("amount", "").lower().strip()
    amount2 = item2.get("amount", "").lower().strip()
    
    # If both have amounts and they're the same, can merge
    # If both have no amounts, can merge
    # If one has amount and other doesn't, keep separate (user might want different units)
    if amount1 and amount2:
        return amount1 == amount2
    
    return True


def merge_items(existing: list[dict], new_item: dict) -> tuple[bool, int]:
    """
    Try to merge a new item with existing items.
    
    Returns:
        Tuple of (merged_with_existing, quantity_adjustment)
        - merged_with_existing: bool indicating if merge happened
        - quantity_adjustment: 0 if no merge, or adjustment made to amount
    """
    name1 = normalize_ingredient_name(new_item.get("name", ""))
    
    for existing_item in existing:
        name2 = normalize_ingredient_name(existing_item.get("name", ""))
        
        if name1 != name2:
            continue
            
        # Check if amounts are compatible for merging
        amount1 = new_item.get("amount", "").lower().strip() or "1"
        amount2 = existing_item.get("amount", "").lower().strip() or "1"
        
        if amount1 == amount2:
            return (True, 0)  # Can merge with no quantity adjustment
    
    return (False, 0)  # Cannot merge


def validate_nutrition_data(data: NutritionCreate | NutritionUpdate) -> dict:
    """Validate nutrition data - ensure non-negative values where applicable."""
    import math
    validation_errors = []
    
    # Fields that must be non-negative if provided
    non_negative_fields = [
        "calories_per_serving", "protein_per_serving", "carbohydrates_per_serving",
        "fat_per_serving", "fiber_per_serving", "sugar_per_serving", "sodium_per_serving",
        "calories_total", "protein_total", "carbohydrates_total", "fat_total",
        "fiber_total", "sugar_total", "sodium_total"
    ]
    
    for field in non_negative_fields:
        value = getattr(data, field)
        if value is not None and (not math.isfinite(value) or value < 0):
            validation_errors.append(f"{field} must be non-negative")
    
    return {"valid": len(validation_errors) == 0, "errors": validation_errors}


def migrate_existing_nutrition():
    """Migrate any existing nutrition data from recipes to separate table."""
    from sqlalchemy import select
    
    try:
        with Session(engine) as session:
            # Check if migration is needed (old schema check)
            result = session.execute(select(func.exists()).where(
                func.table_name() == "recipes"
            )).scalar_one()
            
            # If recipes table has nutrition columns, migrate them
            try:
                recipe_row = session.query(Recipe).first()
                if hasattr(recipe_row, 'calories_per_serving'):  # Old schema
                    print("Migrating nutrition data from Recipe to Nutrition table...")
                    for recipe in session.query(Recipe).all():
                        if getattr(recipe, 'calories_per_serving', None):
                            nutrition = Nutrition(
                                recipe_id=recipe.id,
                                calories_per_serving=recipe.calories_per_serving,
                                protein_per_serving=recipe.protein_per_serving,
                                carbohydrates_per_serving=recipe.carbohydrates_per_serving,
                                fat_per_serving=recipe.fat_per_serving,
                                fiber_per_serving=recipe.fiber_per_serving,
                                sugar_per_serving=recipe.sugar_per_serving,
                                sodium_per_serving=recipe.sodium_per_serving,
                            )
                            session.add(nutrition)
                        else:
                            # Create empty nutrition record for recipes without nutrition
                            nutrition = Nutrition(recipe_id=recipe.id)
                            session.add(nutrition)
                    session.commit()
                    print("Migration complete.")
            except AttributeError:
                pass  # Already using new schema
    except Exception as e:
        print(f"Migration error (may be expected): {e}")


@contextmanager
def get_db_context():
    """Context manager for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Application setup
app = FastAPI(title="Food Webapp API", version="1.0.0")

# Add CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """Create tables on startup."""
    Base.metadata.create_all(bind=engine)
    # Add missing columns to existing SQLite installs without dropping data.
    from sqlalchemy import inspect, text
    existing = {col["name"] for col in inspect(engine).get_columns("recipes")}
    with engine.begin() as connection:
        for field in ("ingredients_text", "steps_ordered", "prep_time", "servings", "category"):
            if field not in existing:
                connection.execute(text(f"ALTER TABLE recipes ADD COLUMN {field} TEXT NOT NULL DEFAULT ''"))


@app.get("/")
def root():
    """Root endpoint."""
    return {"service": "food-webapp", "version": "1.0.0"}


@app.get("/health")
def health_check():
    """Health check endpoint."""
    try:
        with get_db_context() as db:
            db.execute(select(func.now()))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


# Images are re-encoded to strip EXIF/location metadata before persistence.
MAX_PHOTO_BYTES = 10 * 1024 * 1024


def photo_dict(photo):
    return {"id": photo.id, "filename": photo.filename, "caption": photo.caption,
            "recipe_id": photo.recipe_id, "url": f"/uploads/photos/{photo.filename}",
            "thumbnail": photo.thumbnail_filename,
            "thumbnail_url": f"/uploads/photos/thumbnails/{photo.thumbnail_filename}" if photo.thumbnail_filename else None,
            "created_at": photo.created_at.isoformat() if photo.created_at else None}


@app.post("/photos", status_code=201)
async def upload_photo(image: Optional[UploadFile] = File(None), image_data: Optional[str] = Form(None),
                       caption: Optional[str] = Form(None), recipe_id: Optional[int] = Form(None)):
    from PIL import Image, ImageOps, UnidentifiedImageError
    from io import BytesIO
    from pathlib import Path
    import uuid
    if image:
        raw = await image.read(MAX_PHOTO_BYTES + 1)
    else:
        try:
            if not image_data or len(image_data) > MAX_PHOTO_BYTES * 4 // 3 + 100:
                raise ValueError()
            raw = base64.b64decode(image_data.split(",", 1)[-1], validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Valid image data is required")
    if not raw or len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo exceeds the 10 MB limit")
    try:
        with Image.open(BytesIO(raw)) as source:
            if source.width * source.height > 25_000_000:
                raise HTTPException(status_code=413, detail="Photo dimensions exceed the limit")
            source.load()
            clean = ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="Unsupported or invalid image")
    with SessionLocal() as db:
        if recipe_id is not None:
            require_record(db, Recipe, recipe_id)
        directory = Path(PHOTO_UPLOAD_DIR)
        (directory / "thumbnails").mkdir(parents=True, exist_ok=True)
        filename = uuid.uuid4().hex + ".jpg"
        thumb = "thumb_" + filename
        try:
            clean.save(directory / filename, "JPEG", quality=90)
            thumbnail = clean.copy()
            thumbnail.thumbnail((400, 400))
            thumbnail.save(directory / "thumbnails" / thumb, "JPEG", quality=85)
            record = Photo(recipe_id=recipe_id, filename=filename, thumbnail_filename=thumb,
                           caption=(caption or "")[:1000], width=clean.width, height=clean.height,
                           file_size_bytes=(directory / filename).stat().st_size, format="jpeg")
            db.add(record)
            db.commit()
            return {"success": True, **photo_dict(record)}
        except Exception:
            db.rollback()
            (directory / filename).unlink(missing_ok=True)
            (directory / "thumbnails" / thumb).unlink(missing_ok=True)
            raise


@app.get("/photos")
def list_photos(recipe_id: Optional[int] = None, limit: int = 100):
    with SessionLocal() as db:
        query = db.query(Photo)
        if recipe_id is not None:
            query = query.filter_by(recipe_id=recipe_id)
        return {"success": True, "photos": [photo_dict(p) for p in query.order_by(Photo.id.desc()).limit(max(1, min(limit, 1000)))]}


def find_photo(db, identifier):
    photo = db.get(Photo, int(identifier)) if identifier.isdigit() else db.query(Photo).filter_by(filename=identifier).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


@app.get("/photos/{identifier}")
def get_photo(identifier: str):
    with SessionLocal() as db:
        return photo_dict(find_photo(db, identifier))


@app.put("/photos/{identifier}")
def update_photo(identifier: str, data: dict):
    with SessionLocal() as db:
        photo = find_photo(db, identifier)
        if "caption" in data:
            photo.caption = str(data["caption"] or "")[:1000]
        if "recipe_id" in data:
            if data["recipe_id"] is not None:
                require_record(db, Recipe, data["recipe_id"])
            photo.recipe_id = data["recipe_id"]
        db.commit()
        return photo_dict(photo)


@app.delete("/photos/{identifier}", status_code=204)
def delete_photo_endpoint(identifier: str):
    from pathlib import Path
    with SessionLocal() as db:
        photo = find_photo(db, identifier)
        directory = Path(PHOTO_UPLOAD_DIR)
        (directory / Path(photo.filename).name).unlink(missing_ok=True)
        if photo.thumbnail_filename:
            (directory / "thumbnails" / Path(photo.thumbnail_filename).name).unlink(missing_ok=True)
        db.delete(photo)
        db.commit()


# Recipe CRUD endpoints
@app.get("/recipes", response_model=list[RecipeResponse])
def get_recipes():
    """Get all recipes."""
    with SessionLocal() as db:
        # Include nutrition if it exists
        recipes = []
        for recipe in db.query(Recipe).all():
            recipe_obj = RecipeResponse.model_validate(recipe)
            
            # Try to include nutrition
            try:
                nutrition = db.query(Nutrition).filter(Nutrition.recipe_id == recipe.id).first()
                if nutrition:
                    recipe_obj.nutrition = NutritionResponse.model_validate(nutrition)
            except Exception:
                pass
            
            recipes.append(recipe_obj)
        return recipes


@app.get("/recipes/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: int):
    """Get a specific recipe with nutrition."""
    with SessionLocal() as db:
        recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        result = RecipeResponse.model_validate(recipe)
        
        try:
            nutrition = db.query(Nutrition).filter(Nutrition.recipe_id == recipe.id).first()
            if nutrition:
                result.nutrition = NutritionResponse.model_validate(nutrition)
        except Exception:
            pass
        
        return result


@app.post("/recipes", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(recipe_data: dict):
    """Create a new recipe from imported data."""
    with SessionLocal() as db:
        try:
            # Extract fields with defaults
            name = recipe_data.get("name") or recipe_data.get("title")
            
            if not name:
                raise HTTPException(
                    status_code=400, 
                    detail="Recipe name or title is required"
                )
            
            url = recipe_data.get("url")
            manual_entry = recipe_data.get("manual_entry")
            source = recipe_data.get("source", "import")
            original_url = recipe_data.get("original_url") or recipe_data.get("url")
            instructions_ordered = recipe_data.get("instructions_ordered", False)
            
            db_recipe = Recipe(
                name=name,
                url=url,
                manual_entry=manual_entry,
                source=source,
                original_url=original_url,
                instructions_ordered=instructions_ordered,
                **{field: recipe_data.get(field, "") for field in ("ingredients_text", "steps_ordered", "prep_time", "servings", "category")}
            )
            db.add(db_recipe)
            db.commit()
            db.refresh(db_recipe)
            
            return RecipeResponse.model_validate(db_recipe)
        except HTTPException:
            raise
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")


@app.put("/recipes/{recipe_id}", response_model=RecipeResponse)
def update_recipe(recipe_id: int, recipe_update: dict):
    """Update a recipe."""
    with SessionLocal() as db:
        try:
            recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
            if not recipe:
                raise HTTPException(status_code=404, detail="Recipe not found")
            
            # Update fields that are provided
            updates = {}
            if "title" in recipe_update:
                recipe_update["name"] = recipe_update["title"]
            if "name" in recipe_update and not str(recipe_update["name"]).strip():
                raise HTTPException(status_code=400, detail="Recipe title is required")
            for field in ["name", "url", "manual_entry", "instructions_ordered", "ingredients_text", "steps_ordered", "prep_time", "servings", "category"]:
                value = recipe_update.get(field)
                if value is not None:
                    updates[field] = value
            
            # source and original_url are typically not updated via API
            if updates:
                for key, value in updates.items():
                    setattr(recipe, key, value)
            
            db.commit()
            db.refresh(recipe)
            
            return RecipeResponse.model_validate(recipe)
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.delete("/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int):
    """Delete a recipe."""
    with SessionLocal() as db:
        recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        try:
            db.query(IngredientModel).filter_by(recipe_id=recipe_id).delete()
            db.query(Nutrition).filter_by(recipe_id=recipe_id).delete()
            db.query(Photo).filter_by(recipe_id=recipe_id).update({"recipe_id": None})
            db.delete(recipe)
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Cannot delete recipe with associated data: {str(e)}")


# ============================================
# BULK ADD RECIPE INGREDIENTS TO GROCERY LIST (FW-10)
# ============================================

@app.post("/recipes/import-url")
def import_recipe_url(data: dict):
    from import_service import fetch_recipe_html, extract_recipe
    url = str(data.get("url") or "").strip()
    try:
        extracted = extract_recipe(fetch_recipe_html(url), url)
        return {"success": True, **extracted}
    except (ValueError, OSError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/recipes/manual-entry/save", response_model=RecipeResponse, status_code=201)
def save_manual_recipe(data: dict):
    if not str(data.get("title") or data.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Recipe title is required")
    data["source"] = "import" if data.get("original_url") else "manual"
    data["instructions_ordered"] = True
    return create_recipe(data)


@app.get("/recipes/{recipe_id}/ingredients", response_model=list[dict])
def get_recipe_ingredients(recipe_id: int):
    """Materialize stable ingredient IDs while preserving original lines."""
    with SessionLocal() as db:
        recipe = db.get(Recipe, recipe_id)
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        lines = [line.strip() for line in (recipe.ingredients_text or "").splitlines() if line.strip()]
        ingredients = db.query(IngredientModel).filter_by(recipe_id=recipe_id).order_by(IngredientModel.id).all()
        if [i.name for i in ingredients] != lines:
            db.query(IngredientModel).filter_by(recipe_id=recipe_id).delete()
            ingredients = [IngredientModel(recipe_id=recipe_id, name=line, amount="") for line in lines]
            db.add_all(ingredients)
            db.commit()
        return [{"id": i.id, "name": i.name, "amount": i.amount or ""} for i in ingredients]



@app.post("/recipes/{recipe_id}/ingredients/add-to-list")
def add_recipe_ingredients_to_list(recipe_id: int, request: RecipeIngredientsRequest):
    if request.recipe_id != recipe_id:
        raise HTTPException(status_code=400, detail="Recipe ID mismatch")
    ingredients = get_recipe_ingredients(recipe_id)
    known_ids = {i["id"] for i in ingredients}
    if not set(request.ingredient_ids).issubset(known_ids):
        raise HTTPException(status_code=400, detail="Unknown ingredient selection")
    selected = [i for i in ingredients if not request.ingredient_ids or i["id"] in request.ingredient_ids]
    with SessionLocal() as db:
        require_record(db, GroceryList, request.grocery_list_id)
        existing = {i.name.casefold().strip() for i in db.query(GroceryItem).filter_by(list_id=request.grocery_list_id)}
        added, skipped = [], 0
        for ingredient in selected:
            name = ingredient["name"]
            if name.casefold().strip() in existing:
                skipped += 1
                continue
            item = GroceryItem(list_id=request.grocery_list_id, name=name, completed=False)
            db.add(item)
            added.append(item)
            existing.add(name.casefold().strip())
        db.commit()
        return {"success": True, "added_count": len(added), "skipped_duplicates": skipped,
                "items_added": [item_dict(i) for i in added]}


# Nutrition endpoints

@app.post("/recipes/{recipe_id}/nutrition", response_model=NutritionResponse, status_code=status.HTTP_201_CREATED)
def create_nutrition(recipe_id: int, nutrition_data: NutritionCreate):
    """Create nutrition data for a recipe."""
    with SessionLocal() as db:
        try:
            # Check if recipe exists
            recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
            if not recipe:
                raise HTTPException(status_code=404, detail="Recipe not found")
            
            # Validate nutrition data
            validation = validate_nutrition_data(nutrition_data)
            if not validation["valid"]:
                raise HTTPException(
                    status_code=400, 
                    detail={"message": "Invalid nutrition values", "errors": validation["errors"]}
                )
            
            # Check if nutrition already exists
            existing = db.query(Nutrition).filter(Nutrition.recipe_id == recipe_id).first()
            if existing:
                raise HTTPException(
                    status_code=409, 
                    detail="Nutrition data already exists for this recipe"
                )
            
            # Create new nutrition record with only provided fields (partial data allowed)
            db_nutrition = Nutrition(recipe_id=recipe_id, serving_size=nutrition_data.serving_size)
            
            # Set per-serving values
            if nutrition_data.calories_per_serving is not None:
                db_nutrition.calories_per_serving = nutrition_data.calories_per_serving
            if nutrition_data.protein_per_serving is not None:
                db_nutrition.protein_per_serving = nutrition_data.protein_per_serving
            if nutrition_data.carbohydrates_per_serving is not None:
                db_nutrition.carbohydrates_per_serving = nutrition_data.carbohydrates_per_serving
            if nutrition_data.fat_per_serving is not None:
                db_nutrition.fat_per_serving = nutrition_data.fat_per_serving
            if nutrition_data.fiber_per_serving is not None:
                db_nutrition.fiber_per_serving = nutrition_data.fiber_per_serving
            if nutrition_data.sugar_per_serving is not None:
                db_nutrition.sugar_per_serving = nutrition_data.sugar_per_serving
            if nutrition_data.sodium_per_serving is not None:
                db_nutrition.sodium_per_serving = nutrition_data.sodium_per_serving
            
            # Set total values
            if nutrition_data.calories_total is not None:
                db_nutrition.calories_total = nutrition_data.calories_total
            if nutrition_data.protein_total is not None:
                db_nutrition.protein_total = nutrition_data.protein_total
            if nutrition_data.carbohydrates_total is not None:
                db_nutrition.carbohydrates_total = nutrition_data.carbohydrates_total
            if nutrition_data.fat_total is not None:
                db_nutrition.fat_total = nutrition_data.fat_total
            if nutrition_data.fiber_total is not None:
                db_nutrition.fiber_total = nutrition_data.fiber_total
            if nutrition_data.sugar_total is not None:
                db_nutrition.sugar_total = nutrition_data.sugar_total
            if nutrition_data.sodium_total is not None:
                db_nutrition.sodium_total = nutrition_data.sodium_total
            
            db.add(db_nutrition)
            db.commit()
            db.refresh(db_nutrition)
            
            return NutritionResponse.model_validate(db_nutrition)
        except HTTPException:
            raise
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")


@app.get("/recipes/{recipe_id}/nutrition", response_model=NutritionResponse)
def get_nutrition(recipe_id: int):
    """Get nutrition data for a recipe."""
    with SessionLocal() as db:
        nutrition = db.query(Nutrition).filter(Nutrition.recipe_id == recipe_id).first()
        
        if not nutrition:
            raise HTTPException(status_code=404, detail="Nutrition data not found")
        
        return NutritionResponse.model_validate(nutrition)


@app.get("/nutrition", response_model=list[NutritionResponse])
def get_all_nutrition():
    """Get all nutrition records."""
    with SessionLocal() as db:
        return [NutritionResponse.model_validate(n) for n in db.query(Nutrition).all()]


@app.put("/recipes/{recipe_id}/nutrition", response_model=NutritionResponse)
def update_nutrition(recipe_id: int, nutrition_update: NutritionUpdate):
    """Update nutrition data for a recipe (partial update)."""
    with SessionLocal() as db:
        try:
            # Check if recipe exists
            recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
            if not recipe:
                raise HTTPException(status_code=404, detail="Recipe not found")
            
            # Get or create nutrition record
            existing = db.query(Nutrition).filter(Nutrition.recipe_id == recipe_id).first()
            if not existing:
                return create_nutrition(recipe_id, nutrition_update)
            
            validation = validate_nutrition_data(nutrition_update)
            if not validation["valid"]:
                raise HTTPException(status_code=400, detail={"message": "Invalid nutrition values", "errors": validation["errors"]})
            for field, value in nutrition_update.model_dump(exclude_unset=True).items():
                setattr(existing, field, value)

            db.commit()
            db.refresh(existing)
            
            return NutritionResponse.model_validate(existing)
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.delete("/recipes/{recipe_id}/nutrition", status_code=status.HTTP_204_NO_CONTENT)
def delete_nutrition(recipe_id: int):
    """Delete nutrition data for a recipe."""
    with SessionLocal() as db:
        nutrition = db.query(Nutrition).filter(Nutrition.recipe_id == recipe_id).first()
        
        if not nutrition:
            raise HTTPException(status_code=404, detail="Nutrition data not found")
        
        try:
            db.delete(nutrition)
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")


def require_record(db, model, record_id):
    record = db.get(model, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


def required_name(data):
    name = str(data.get("name") or "").strip()
    if not name or len(name) > 1000:
        raise HTTPException(status_code=400, detail="A name of 1–1000 characters is required")
    return name


def item_dict(item):
    return {"id": item.id, "name": item.name, "completed": item.completed}


def list_dict(db, record):
    return {"id": record.id, "name": record.name,
            "items": [item_dict(i) for i in db.query(GroceryItem).filter_by(list_id=record.id).order_by(GroceryItem.id)]}


@app.get("/grocery-lists")
def get_grocery_lists():
    with SessionLocal() as db:
        return [list_dict(db, record) for record in db.query(GroceryList).order_by(GroceryList.id)]


@app.post("/grocery-lists", status_code=201)
def create_grocery_list(data: dict):
    with SessionLocal() as db:
        record = GroceryList(name=required_name(data))
        db.add(record)
        db.commit()
        return list_dict(db, record)


@app.get("/grocery-lists/{list_id}")
def get_grocery_list(list_id: int):
    with SessionLocal() as db:
        return list_dict(db, require_record(db, GroceryList, list_id))


@app.patch("/grocery-lists/{list_id}")
@app.put("/grocery-lists/{list_id}")
def rename_grocery_list(list_id: int, data: dict):
    with SessionLocal() as db:
        record = require_record(db, GroceryList, list_id)
        record.name = required_name(data)
        db.commit()
        return list_dict(db, record)


@app.delete("/grocery-lists/{list_id}", status_code=204)
def remove_grocery_list(list_id: int):
    with SessionLocal() as db:
        record = require_record(db, GroceryList, list_id)
        db.query(GroceryItem).filter_by(list_id=list_id).delete()
        db.delete(record)
        db.commit()


@app.post("/grocery-lists/{list_id}/items", status_code=201)
def create_grocery_item(list_id: int, data: dict):
    with SessionLocal() as db:
        require_record(db, GroceryList, list_id)
        item = GroceryItem(list_id=list_id, name=required_name(data), completed=False)
        db.add(item)
        db.commit()
        return item_dict(item)


@app.patch("/grocery-lists/{list_id}/items/{item_id}")
@app.put("/grocery-lists/{list_id}/items/{item_id}")
def update_grocery_item(list_id: int, item_id: int, data: dict):
    with SessionLocal() as db:
        item = require_record(db, GroceryItem, item_id)
        if item.list_id != list_id:
            raise HTTPException(status_code=404, detail="Item not found in this list")
        if "name" in data:
            item.name = required_name(data)
        if "completed" in data:
            if not isinstance(data["completed"], bool):
                raise HTTPException(status_code=400, detail="completed must be boolean")
            item.completed = data["completed"]
        db.commit()
        return item_dict(item)


@app.delete("/grocery-lists/{list_id}/items/{item_id}", status_code=204)
def remove_grocery_item(list_id: int, item_id: int):
    with SessionLocal() as db:
        item = require_record(db, GroceryItem, item_id)
        if item.list_id != list_id:
            raise HTTPException(status_code=404, detail="Item not found in this list")
        db.delete(item)
        db.commit()

@app.get("/recipes/{recipe_id}/photos", response_model=list[dict])
def get_recipe_photos(recipe_id: int):
    with SessionLocal() as db:
        require_record(db, Recipe, recipe_id)
        return [photo_dict(p) for p in db.query(Photo).filter_by(recipe_id=recipe_id).order_by(Photo.id.desc())]


os.makedirs(PHOTO_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads/photos", StaticFiles(directory=PHOTO_UPLOAD_DIR), name="photos")
