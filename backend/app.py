"""Food Webapp FastAPI backend with recipe and nutrition support."""
from fastapi import FastAPI, Depends, HTTPException, status, File, Form, UploadFile, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ConfigDict, field_validator
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

if engine.dialect.name == 'sqlite':
    from sqlalchemy import event
    @event.listens_for(engine, 'connect')
    def sqlite_integrity(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA busy_timeout=10000')

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
    description = Column(Text, default="")
    cook_time = Column(String(200), default="")
    notes = Column(Text, default="")
    favorite = Column(Boolean, default=False)
    cover_photo_id = Column(Integer, nullable=True)
    last_cooked_at = Column(String, nullable=True)

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
    position = Column(Integer, default=0, nullable=False)
    revision = Column(Integer, default=0, nullable=False)


class GroceryItem(Base):
    __tablename__ = "grocery_items"
    id = Column(Integer, primary_key=True)
    list_id = Column(Integer, ForeignKey("grocery_lists.id"), nullable=False)
    name = Column(String(1000), nullable=False)
    completed = Column(Boolean, default=False)
    position = Column(Integer, default=0, nullable=False)
    version = Column(Integer, default=0, nullable=False)
    quantity = Column(String(200), default="")
    unit = Column(String(200), default="")
    category = Column(String(200), default="")
    notes = Column(String(2000), default="")
    deleted_at = Column(String, nullable=True)


class MutationReceipt(Base):
    __tablename__ = "mutation_receipts"
    key = Column(String(100), primary_key=True)
    payload = Column(Text, nullable=False)
    result = Column(Text, nullable=False)


class RecordSequence(Base):
    """Durable identity high-water marks, including legacy SQLite tables."""
    __tablename__ = 'record_sequences'
    name = Column(String(100), primary_key=True)
    value = Column(Integer, nullable=False)


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
    description: str = ""
    cook_time: str = ""
    notes: str = ""
    favorite: bool = False
    cover_photo_id: Optional[int] = None
    cover_url: Optional[str] = None
    last_cooked_at: Optional[str] = None
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


from sqlalchemy import event, text as sql_text


def assign_durable_id(mapper, connection, target):
    if connection.dialect.name != 'sqlite' or target.id is not None:
        return
    table = target.__tablename__  # Static model-owned name, never request input.
    target.id = connection.execute(sql_text(
        f"INSERT INTO record_sequences (name, value) "
        f"SELECT :name, COALESCE(MAX(id), 0) + 1 FROM {table} WHERE 1 "
        "ON CONFLICT(name) DO UPDATE SET value = MAX(record_sequences.value + 1, excluded.value) RETURNING value"
    ), {'name': table}).scalar_one()


for identity_model in (Recipe, Nutrition, Photo, GroceryList, GroceryItem, IngredientModel):
    event.listen(identity_model, 'before_insert', assign_durable_id)


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
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    from migrations import migrate
    migrate(engine, Base.metadata)


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
            clean.thumbnail((2400, 2400))
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
        if 'recipe_id' in data and data['recipe_id'] != photo.recipe_id:
            db.query(Recipe).filter_by(cover_photo_id=photo.id).update({'cover_photo_id': None})
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
        paths = [directory / Path(photo.filename).name]
        if photo.thumbnail_filename:
            paths.append(directory / 'thumbnails' / Path(photo.thumbnail_filename).name)
        db.query(Recipe).filter_by(cover_photo_id=photo.id).update({'cover_photo_id': None})
        db.delete(photo)
        db.commit()
        # DB success precedes file cleanup: a failed transaction cannot erase a live image.
        for path in paths:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                import logging
                logging.getLogger(__name__).warning('Orphan photo file needs cleanup: %s', path.name)


class RecipeWrite(BaseModel):
    name: Optional[str] = Field(default=None, max_length=500)
    title: Optional[str] = Field(default=None, max_length=500)
    url: Optional[str] = Field(default=None, max_length=1024)
    original_url: Optional[str] = Field(default=None, max_length=1024)
    manual_entry: Optional[str] = Field(default=None, max_length=100000)
    source: str = 'manual'
    instructions_ordered: bool = True
    ingredients_text: str = Field(default='', max_length=100000)
    steps_ordered: str = Field(default='', max_length=100000)
    prep_time: str = Field(default='', max_length=200)
    cook_time: str = Field(default='', max_length=200)
    servings: str = Field(default='', max_length=200)
    category: str = Field(default='', max_length=200)
    description: str = Field(default='', max_length=10000)
    notes: str = Field(default='', max_length=10000)
    favorite: Optional[bool] = None
    cover_photo_id: Optional[int] = None
    last_cooked_at: Optional[str] = Field(default=None, max_length=100)
    nutrition: Optional[NutritionCreate] = None


# Recipe CRUD endpoints
@app.get("/recipes", response_model=list[RecipeResponse])
def get_recipes():
    """Get all recipes."""
    with SessionLocal() as db:
        # Include nutrition if it exists
        recipes = []
        for recipe in db.query(Recipe).all():
            recipe_obj = RecipeResponse.model_validate(recipe)
            cover = db.get(Photo, recipe.cover_photo_id) if recipe.cover_photo_id else db.query(Photo).filter_by(recipe_id=recipe.id).order_by(Photo.id.desc()).first()
            recipe_obj.cover_url = photo_dict(cover)["thumbnail_url"] or photo_dict(cover)["url"] if cover and cover.recipe_id == recipe.id else None
            
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
def create_recipe(recipe_data: RecipeWrite):
    recipe_data = recipe_data.model_dump(exclude_unset=True)
    """Create a new recipe from imported data."""
    with SessionLocal() as db:
        try:
            # Extract fields with defaults
            name = recipe_data.get("name") or recipe_data.get("title")
            
            if not isinstance(name, str) or not name.strip() or len(name) > 500:
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
                **{field: recipe_data.get(field, "") for field in ("ingredients_text", "steps_ordered", "prep_time", "servings", "category", "description", "cook_time", "notes")}
            )
            db.add(db_recipe)
            db.flush()
            if recipe_data.get('nutrition'):
                nutrition_data = NutritionCreate(**recipe_data['nutrition'])
                validation = validate_nutrition_data(nutrition_data)
                if not validation['valid']:
                    raise HTTPException(400, 'Nutrition values must be nonnegative and finite')
                db.add(Nutrition(recipe_id=db_recipe.id, **nutrition_data.model_dump()))
            db.commit()
            db.refresh(db_recipe)
            
            return RecipeResponse.model_validate(db_recipe)
        except HTTPException:
            raise
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")


@app.put("/recipes/{recipe_id}", response_model=RecipeResponse)
def update_recipe(recipe_id: int, recipe_update: RecipeWrite):
    recipe_update = recipe_update.model_dump(exclude_unset=True)
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
            for field in ["name", "url", "manual_entry", "instructions_ordered", "ingredients_text", "steps_ordered", "prep_time", "servings", "category", "description", "cook_time", "notes", "favorite", "original_url", "cover_photo_id", "last_cooked_at"]:
                value = recipe_update.get(field)
                if value is not None:
                    updates[field] = value
            
            if "cover_photo_id" in recipe_update:
                cover_id = recipe_update["cover_photo_id"]
                cover = db.get(Photo, cover_id) if cover_id else None
                if cover_id and (not cover or cover.recipe_id != recipe_id):
                    raise HTTPException(400, "Choose a photo associated with this recipe")
                recipe.cover_photo_id = cover_id
            if "favorite" in recipe_update and not isinstance(recipe_update["favorite"], bool):
                raise HTTPException(400, "favorite must be boolean")
            # Source attribution remains editable without fetching the URL.
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
def save_manual_recipe(data: RecipeWrite):
    data = data.model_dump(exclude_unset=True)
    if not str(data.get("title") or data.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Recipe title is required")
    data["source"] = "import" if data.get("original_url") else "manual"
    data["instructions_ordered"] = True
    return create_recipe(RecipeWrite(**data))


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
        locked_db(db)
        require_record(db, GroceryList, request.grocery_list_id)
        existing = {i.name.casefold().strip() for i in active_items(db, request.grocery_list_id)}
        added, skipped = [], 0
        for ingredient in selected:
            name = ingredient["name"]
            if name.casefold().strip() in existing:
                skipped += 1
                continue
            item = GroceryItem(list_id=request.grocery_list_id, name=name, completed=False, position=next_position(db, GroceryItem, request.grocery_list_id) + len(added))
            db.add(item)
            added.append(item)
            existing.add(name.casefold().strip())
        require_record(db, GroceryList, request.grocery_list_id).revision += 1
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


class NamedRequest(BaseModel):
    name: str = Field(min_length=1, max_length=500)

    @field_validator('name')
    @classmethod
    def clean_name(cls, value):
        if not value.strip():
            raise ValueError('Enter a name')
        return value.strip()


class ItemCreate(NamedRequest):
    name: str = Field(min_length=1, max_length=1000)
    quantity: str = Field(default='', max_length=200)
    unit: str = Field(default='', max_length=200)
    category: str = Field(default='', max_length=200)
    notes: str = Field(default='', max_length=2000)
    completed: bool = False


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=1000)
    completed: Optional[bool] = None
    quantity: Optional[str] = Field(default=None, max_length=200)
    unit: Optional[str] = Field(default=None, max_length=200)
    category: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    expected_version: Optional[int] = None


class OrderRequest(BaseModel):
    ids: list[int] = Field(max_length=10000)
    expected_ids: Optional[list[int]] = None
    expected_revision: Optional[int] = None


class BulkItems(BaseModel):
    items: list[ItemCreate] = Field(min_length=1, max_length=500)
    operation_id: str = Field(min_length=1, max_length=100)
    duplicate_policy: str = 'keep'

    @field_validator('duplicate_policy')
    @classmethod
    def policy(cls, value):
        if value not in ('keep', 'merge'):
            raise ValueError('Choose keep or merge')
        return value


class TransferItems(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=500)
    target_list_id: int
    copy_items: bool = Field(default=False, alias='copy')
    expected_revision: int


class RevisionRequest(BaseModel):
    expected_revision: int


def locked_db(db):
    # Serialize SQLite read-modify-write sequences, including revision checks.
    if engine.dialect.name == 'sqlite':
        db.connection().exec_driver_sql('BEGIN IMMEDIATE')


def next_position(db, model, list_id=None):
    query = db.query(func.max(model.position))
    if list_id is not None:
        query = query.filter(model.list_id == list_id)
    value = query.scalar()
    return (value if value is not None else -1) + 1


def active_items(db, list_id):
    return db.query(GroceryItem).filter_by(list_id=list_id, deleted_at=None).order_by(GroceryItem.position, GroceryItem.id).all()


def item_dict(item):
    return {key: getattr(item, key) for key in ('id','name','completed','position','version','quantity','unit','category','notes')}


def list_dict(db, record):
    return {'id': record.id, 'name': record.name, 'position': record.position, 'revision': record.revision,
            'items': [item_dict(i) for i in active_items(db, record.id)]}


def check_revision(record, expected):
    if expected is not None and record.revision != expected:
        raise HTTPException(409, 'This list changed elsewhere. Refresh it before trying again; your input has been kept.')


def validate_order(ids, records):
    if len(ids) != len(set(ids)) or set(ids) != {r.id for r in records}:
        raise HTTPException(409, 'The contents changed. Refresh before reordering.')


@app.get('/grocery-lists')
def get_grocery_lists():
    with SessionLocal() as db:
        return [list_dict(db, r) for r in db.query(GroceryList).order_by(GroceryList.position, GroceryList.id)]


# Register static paths before /{list_id}.
@app.put('/grocery-lists/order')
def reorder_lists(data: OrderRequest):
    with SessionLocal() as db:
        locked_db(db)
        records = db.query(GroceryList).order_by(GroceryList.position, GroceryList.id).all()
        validate_order(data.ids, records)
        if data.expected_ids is not None and data.expected_ids != [r.id for r in records]:
            raise HTTPException(409, 'List order changed elsewhere. Refresh before moving it again.')
        for record in records:
            record.position = data.ids.index(record.id)
        db.commit()
        return {'ids': data.ids}


@app.post('/grocery-lists', status_code=201)
def create_grocery_list(data: NamedRequest):
    with SessionLocal() as db:
        locked_db(db)
        record = GroceryList(name=data.name, position=next_position(db, GroceryList))
        db.add(record)
        db.commit()
        return list_dict(db, record)


@app.get('/grocery-lists/{list_id}')
def get_grocery_list(list_id: int):
    with SessionLocal() as db:
        return list_dict(db, require_record(db, GroceryList, list_id))


@app.patch('/grocery-lists/{list_id}')
@app.put('/grocery-lists/{list_id}')
def rename_grocery_list(list_id: int, data: NamedRequest):
    with SessionLocal() as db:
        locked_db(db)
        record = require_record(db, GroceryList, list_id)
        record.name = data.name
        record.revision += 1
        db.commit()
        return list_dict(db, record)


@app.delete('/grocery-lists/{list_id}', status_code=204)
def remove_grocery_list(list_id: int):
    with SessionLocal() as db:
        locked_db(db)
        record = require_record(db, GroceryList, list_id)
        db.query(GroceryItem).filter_by(list_id=list_id).delete()
        db.delete(record)
        db.commit()


@app.post('/grocery-lists/{list_id}/duplicate', status_code=201)
def duplicate_list(list_id: int):
    with SessionLocal() as db:
        locked_db(db)
        source = require_record(db, GroceryList, list_id)
        copy = GroceryList(name=source.name + ' (copy)', position=next_position(db, GroceryList))
        db.add(copy)
        db.flush()
        for i in active_items(db, list_id):
            db.add(GroceryItem(list_id=copy.id, **{k: getattr(i,k) for k in ('name','quantity','unit','category','notes','position')}, completed=False))
        db.commit()
        return list_dict(db, copy)


@app.put('/grocery-lists/{list_id}/items/order')
def reorder_items(list_id: int, data: OrderRequest):
    with SessionLocal() as db:
        locked_db(db)
        record = require_record(db, GroceryList, list_id)
        check_revision(record, data.expected_revision)
        items = active_items(db, list_id)
        validate_order(data.ids, items)
        for item in items:
            item.position = data.ids.index(item.id)
            item.version += 1
        record.revision += 1
        db.commit()
        return list_dict(db, record)


@app.post('/grocery-lists/{list_id}/items/bulk', status_code=201)
def bulk_items(list_id: int, data: BulkItems):
    import json
    with SessionLocal() as db:
        locked_db(db)
        payload = json.dumps({'list_id': list_id, **data.model_dump()}, sort_keys=True)
        record = require_record(db, GroceryList, list_id)
        receipt = db.get(MutationReceipt, data.operation_id)
        if receipt:
            if receipt.payload != payload:
                raise HTTPException(409, 'This operation ID was already used for different items')
            return json.loads(receipt.result)
        existing = active_items(db, list_id)
        position = next_position(db, GroceryItem, list_id)
        merged = 0
        for offset, entry in enumerate(data.items):
            fields = entry.model_dump()
            match = next((i for i in existing if i.name.casefold().strip() == entry.name.casefold().strip()
                          and i.unit.casefold() == entry.unit.casefold() and i.category == entry.category and i.notes == entry.notes), None)
            # Never guess freeform measurements. Merge only numeric compatible quantities.
            if match and data.duplicate_policy == 'merge' and match.quantity and entry.quantity:
                from decimal import Decimal, InvalidOperation
                try:
                    first, second = Decimal(match.quantity), Decimal(entry.quantity)
                    if first.is_finite() and second.is_finite() and first >= 0 and second >= 0:
                        match.quantity = format(first + second, 'f')
                        match.completed = False
                        match.version += 1
                        merged += 1
                        continue
                except InvalidOperation:
                    pass
            item = GroceryItem(list_id=list_id, position=position + offset, **fields)
            db.add(item)
            existing.append(item)
        record.revision += 1
        db.flush()
        result = {'list': list_dict(db, record), 'added_count': len(data.items) - merged, 'merged_count': merged}
        db.add(MutationReceipt(key=data.operation_id, payload=payload, result=json.dumps(result)))
        db.commit()
        return result


@app.post('/grocery-lists/{list_id}/items', status_code=201)
def create_grocery_item(list_id: int, data: ItemCreate):
    with SessionLocal() as db:
        locked_db(db)
        record = require_record(db, GroceryList, list_id)
        item = GroceryItem(list_id=list_id, position=next_position(db, GroceryItem, list_id), **data.model_dump())
        db.add(item)
        record.revision += 1
        db.commit()
        return item_dict(item)


@app.patch('/grocery-lists/{list_id}/items/{item_id}')
@app.put('/grocery-lists/{list_id}/items/{item_id}')
def update_grocery_item(list_id: int, item_id: int, data: ItemUpdate):
    with SessionLocal() as db:
        locked_db(db)
        item = require_record(db, GroceryItem, item_id)
        if item.list_id != list_id or item.deleted_at:
            raise HTTPException(404, 'Item not found in this list')
        if data.expected_version is not None and data.expected_version != item.version:
            raise HTTPException(409, 'This item changed elsewhere. Refresh before saving; your input has been kept.')
        for key, value in data.model_dump(exclude_unset=True, exclude={'expected_version'}).items():
            if value is None:
                raise HTTPException(400, f'{key} cannot be null')
            if key == 'name' and not value.strip():
                raise HTTPException(400, 'Enter an item name')
            setattr(item, key, value.strip() if key == 'name' else value)
        item.version += 1
        require_record(db, GroceryList, list_id).revision += 1
        db.commit()
        return item_dict(item)


@app.delete('/grocery-lists/{list_id}/items/{item_id}', status_code=204)
def remove_grocery_item(list_id: int, item_id: int):
    with SessionLocal() as db:
        locked_db(db)
        item = require_record(db, GroceryItem, item_id)
        if item.list_id != list_id:
            raise HTTPException(404, 'Item not found in this list')
        item.deleted_at = datetime.now(timezone.utc).isoformat()
        item.version += 1
        require_record(db, GroceryList, list_id).revision += 1
        db.commit()


@app.post('/grocery-lists/{list_id}/restore')
def restore_items(list_id: int, data: OrderRequest):
    with SessionLocal() as db:
        locked_db(db)
        record = require_record(db, GroceryList, list_id)
        items = db.query(GroceryItem).filter(GroceryItem.list_id == list_id, GroceryItem.id.in_(data.ids)).all()
        if len(items) != len(set(data.ids)):
            raise HTTPException(404, 'Items no longer belong to this list')
        for item in items:
            item.deleted_at = None
            item.version += 1
        record.revision += 1
        db.commit()
        return list_dict(db, record)


@app.post('/grocery-lists/{list_id}/reset')
@app.post('/grocery-lists/{list_id}/clear-completed')
def completed_action(list_id: int, data: RevisionRequest, request: Request):
    with SessionLocal() as db:
        locked_db(db)
        record = require_record(db, GroceryList, list_id)
        check_revision(record, data.expected_revision)
        completed = [i for i in active_items(db, list_id) if i.completed]
        for item in completed:
            if request.url.path.endswith('/reset'):
                item.completed = False
            else:
                item.deleted_at = datetime.now(timezone.utc).isoformat()
            item.version += 1
        record.revision += 1
        db.commit()
        return {'list': list_dict(db, record), 'ids': [i.id for i in completed]}


@app.post('/grocery-lists/{list_id}/transfer')
def transfer_items(list_id: int, data: TransferItems):
    with SessionLocal() as db:
        locked_db(db)
        source = require_record(db, GroceryList, list_id)
        target = require_record(db, GroceryList, data.target_list_id)
        check_revision(source, data.expected_revision)
        if list_id == target.id:
            raise HTTPException(400, 'Choose another list')
        items = [i for i in active_items(db, list_id) if i.id in data.ids]
        if len(items) != len(set(data.ids)):
            raise HTTPException(409, 'Selected items changed. Refresh before transferring.')
        position = next_position(db, GroceryItem, target.id)
        for offset, item in enumerate(items):
            if data.copy_items:
                db.add(GroceryItem(list_id=target.id, position=position + offset,
                    **{key: getattr(item,key) for key in ('name','quantity','unit','category','notes','completed')}))
            else:
                item.list_id = target.id
                item.position = position + offset
                item.version += 1
        source.revision += 1
        target.revision += 1
        db.commit()
        return list_dict(db, source)

@app.get("/recipes/{recipe_id}/photos", response_model=list[dict])
def get_recipe_photos(recipe_id: int):
    with SessionLocal() as db:
        require_record(db, Recipe, recipe_id)
        return [photo_dict(p) for p in db.query(Photo).filter_by(recipe_id=recipe_id).order_by(Photo.id.desc())]


os.makedirs(PHOTO_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads/photos", StaticFiles(directory=PHOTO_UPLOAD_DIR), name="photos")
