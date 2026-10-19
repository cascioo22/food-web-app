"""Food Webapp FastAPI backend with recipe and nutrition support."""
from fastapi import FastAPI, Depends, HTTPException, status, File, Form
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
PHOTO_UPLOAD_DIR = "/opt/data/home/food-webapp-project/uploads/photos"

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
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
    
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


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
    created_at = Column(DateTime, default=datetime.now(timezone.utc))


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
    
    created_at: Optional[str]
    updated_at: Optional[str]
    
    class Config:
        from_attributes = True


class RecipeResponse(BaseModel):
    """Schema for recipe response."""
    id: int
    name: str
    url: Optional[str]
    manual_entry: Optional[str]
    source: str
    original_url: Optional[str]
    instructions_ordered: bool
    created_at: Optional[str]
    updated_at: Optional[str]
    
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


def validate_nutrition_data(data: NutritionCreate) -> dict:
    """Validate nutrition data - ensure non-negative values where applicable."""
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
        if value is not None and value < 0:
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


# Photo Upload Endpoints (FW-08)
@app.post("/photos")
def upload_photo(
    image_data: str = Form(),
    caption: Optional[str] = Form(None),
    recipe_id: Optional[int] = Form(None),
):
    """Upload a finished food photo."""
    from io import BytesIO
    
    if not image_data:
        return {"success": False, "error": "No image data provided"}, 400
    
    try:
        # Decode base64 data
        decoded_bytes = base64.b64decode(image_data)
        
        # Validate the image first using photos module
        validation = validate_image_data(f"data:image/png;base64,{image_data}")
        
        if not validation["success"]:
            return {"success": False, "error": validation["error"]}, 400
        
        # Create upload directory structure
        os.makedirs(PHOTO_UPLOAD_DIR, exist_ok=True)
        os.makedirs(os.path.join(PHOTO_UPLOAD_DIR, "thumbnails"), exist_ok=True)
        
        # Generate safe filename
        import uuid
        safe_name = generate_safe_filename(str(uuid.uuid4()), 'uploaded_image')
        photo_filename = f"{safe_name}.jpg"
        thumb_filename = None
        
        try:
            # Upload the image
            result = upload_photo(
                image_bytes=decoded_bytes,
                filename=safe_name,
                caption=caption or "",
                recipe_id=recipe_id,
                thumbnail=True
            )
            
            if not result["success"]:
                return {"success": False, "error": result.get("error", "Unknown error")}, 500
            
            thumb_filename = f"thumb_{safe_name}.jpg"
            
            # Store metadata in database
            db = next(get_db())
            # Use Photo directly (no circular import)
            photo_record = Photo(
                recipe_id=recipe_id,
                filename=photo_filename,
                thumbnail_filename=thumb_filename,
                caption=caption or None,
                file_size_bytes=len(decoded_bytes),
                format="jpeg"
            )
            db.add(photo_record)
            db.commit()
            
            return {
                "success": True,
                "message": "Photo uploaded successfully",
                "filename": photo_filename,
                "thumbnail": thumb_filename,
                "caption": caption or None,
                "recipe_id": recipe_id
            }
            
        except Exception as e:
            db.rollback()
            return {"success": False, "error": str(e)}, 500
            
    except Exception as e:
        return {"success": False, "error": f"Upload failed: {str(e)}"}, 400


@app.delete("/photos/{filename}")
def delete_photo_endpoint(filename: str):
    """Delete a photo and its thumbnail."""
    from pathlib import Path
    
    result = delete_photo(filename)
    
    if result["success"]:
        # Delete database record (if implemented)
        db = next(get_db())
        try:
            # Use Photo directly (no circular import)
            to_delete = db.query(Photo).filter_by(filename=filename).first()
            if to_delete:
                db.delete(to_delete)
                db.commit()
        except Exception:
            pass  # Database cleanup is optional for now
        
        return {"success": True, "message": f"Photo '{filename}' deleted successfully"}
    
    return result


@app.get("/photos")
def list_photos(recipe_id: Optional[int] = None, limit: int = 100):
    """List photos, optionally filtered by recipe."""
    db = next(get_db())
    
    query = db.query(Photo)
    if recipe_id:
        query = query.filter_by(recipe_id=recipe_id)
    
    photos = query.order_by(Photo.created_at.desc()).limit(limit).all()
    
    return {
        "success": True,
        "photos": [
            {
                "id": photo.id,
                "filename": photo.filename,
                "thumbnail": photo.thumbnail_filename,
                "caption": photo.caption,
                "created_at": photo.created_at.isoformat() if photo.created_at else None
            } for photo in photos
        ]
    }


@app.get("/photos/{filename}")
def get_photo(filename: str):
    """Get a specific photo."""
    from pathlib import Path
    
    # Check if photo exists
    if not os.path.exists(os.path.join(PHOTO_UPLOAD_DIR, filename)):
        return {"success": False, "error": "Photo not found"}, 404
    
    with open(os.path.join(PHOTO_UPLOAD_DIR, filename), 'rb') as f:
        photo_bytes = f.read()
    
    # Get thumbnail if available
    thumb_filename = None
    thumb_path = os.path.join(PHOTO_UPLOAD_DIR, "thumbnails", f"thumb_{filename}")
    if os.path.exists(thumb_path):
        with open(thumb_path, 'rb') as tf:
            thumb_bytes = tf.read()
        thumb_filename = f"thumb_{filename}"
    
    return {
        "success": True,
        "filename": filename,
        "data": base64.b64encode(photo_bytes).decode('utf-8'),
        "thumbnail_data": base64.b64encode(thumb_bytes).decode('utf-8') if thumb_filename else None,
        "thumb_filename": thumb_filename
    }


# Recipe CRUD endpoints
@app.get("/recipes", response_model=list[RecipeResponse])
def get_recipes():
    """Get all recipes."""
    print("=== DEBUG: /recipes endpoint called ===")  # Debug output
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
                instructions_ordered=instructions_ordered
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
            for field in ["name", "url", "manual_entry", "instructions_ordered"]:
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
            db.delete(recipe)
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Cannot delete recipe with associated data: {str(e)}")


# ============================================
# BULK ADD RECIPE INGREDIENTS TO GROCERY LIST (FW-10)
# ============================================

@app.get("/recipes/{recipe_id}/ingredients", response_model=list[dict])
def get_recipe_ingredients(recipe_id: int):
    """Get structured ingredient list for a recipe."""
    from sqlalchemy import inspect as sqla_inspect
    
    with SessionLocal() as db:
        # Check if ingredients table exists first
        inspector = sqla_inspect(db.get_bind())
        if "ingredients" not in inspector.get_table_names():
            # Table doesn't exist yet, parse from text instead
            recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
            if not recipe:
                raise HTTPException(status_code=404, detail="Recipe not found")
            
            ingredients_text = recipe.ingredients_text or ""
            parsed_ingredients = parse_ingredients_text(ingredients_text)
            # Return as dicts without IDs for now
            return [{"name": ing["name"], "amount": ing["amount"]} for ing in parsed_ingredients]
        
        # Table exists - return from structured storage
        recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        ingredients = db.query(IngredientModel).filter(IngredientModel.recipe_id == recipe_id).all()
        return [{"id": ing.id, "name": ing.name, "amount": ing.amount} for ing in ingredients]



@app.post("/recipes/{recipe_id}/ingredients/add-to-list", response_model=BulkAddResult)
def add_recipe_ingredients_to_list(request: RecipeIngredientsRequest):
    """Add selected ingredients from a recipe to a grocery list."""
    from sqlalchemy import inspect as sqla_inspect
    
    with SessionLocal() as db:
        # Validate recipe exists
        recipe = db.query(Recipe).filter(Recipe.id == request.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Check if grocery_lists table exists
        inspector = sqla_inspect(db.get_bind())
        if "grocery_lists" not in inspector.get_table_names():
            # Grocery list feature not available yet (depends on FW-07)
            return BulkAddResult(
                success=False,
                added_count=0,
                skipped_duplicates=0,
                items_added=[],
                warning="Grocery lists feature not yet implemented. Please create grocery list via FW-07."
            )
        
        # Check if ingredients table exists
        if "ingredients" not in inspector.get_table_names():
            # Parse from text instead
            ingredients_text = recipe.ingredients_text or ""
            parsed_ingredients = parse_ingredients_text(ingredients_text)
            
            # Filter selected if specified
            if request.ingredient_ids:
                all_ids = []
                for idx, ing in enumerate(parsed_ingredients):
                    all_ids.append({"id": idx, "name": ing["name"], "amount": ing["amount"]})
            else:
                all_ids = parsed_ingredients
            
            return BulkAddResult(
                success=True,
                added_count=len(all_ids),
                skipped_duplicates=0,
                items_added=all_ids
            )
        
        # Table exists - get structured ingredients
        ingredients = db.query(IngredientModel).filter(IngredientModel.recipe_id == recipe_id).all()
        
        if request.ingredient_ids:
            selected_ingredients = [ing for ing in ingredients if ing.id in request.ingredient_ids]
        else:
            selected_ingredients = ingredients
        
        # Convert to response format
        result_items = [{"id": ing.id, "name": ing.name, "amount": ing.amount, "checked": ing.checked} for ing in selected_ingredients]
        
        return BulkAddResult(
            success=True,
            added_count=len(result_items),
            skipped_duplicates=0,
            items_added=result_items
        )

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
            db_nutrition = Nutrition(recipe_id=recipe_id)
            
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
            
            # Partial update - only set fields that are provided and not None
            for field in ["serving_size", "calories_per_serving", "protein_per_serving",
                         "carbohydrates_per_serving", "fat_per_serving", "fiber_per_serving",
                         "sugar_per_serving", "sodium_per_serving", "calories_total",
                         "protein_total", "carbohydrates_total", "fat_total", "fiber_total",
                         "sugar_total", "sodium_total"]:
                value = getattr(nutrition_update, field)
                if value is not None:
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


@app.get("/grocery-lists")
def get_grocery_lists():
    """Get all grocery lists (stub - feature not yet implemented)."""
    return {"success": True, "grocery_lists": [], "warning": "Grocery lists feature not yet implemented."}


@app.post("/grocery-lists")
def create_grocery_list(data: dict):
    """Create a grocery list (stub)."""
    return {"success": True, "message": "Grocery list created"}

# Photos endpoints (from photos.py)
@app.get("/recipes/{recipe_id}/photos", response_model=list[dict])
def get_recipe_photos(recipe_id: int):
    """Get photos for a recipe."""
    try:
        with SessionLocal() as db:
            # Import Recipe model here to avoid circular import
            from backend.recipe_import import Recipe, Nutrition
            recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
            if not recipe:
                raise HTTPException(status_code=404, detail="Recipe not found")
            
            # Get photo paths (implementation depends on actual storage)
            return [{"path": "/photos/placeholder.jpg"}]
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recipes/{recipe_id}/photos", response_model=dict)
def add_recipe_photo(recipe_id: int, photo_path: str):
    """Add a photo to a recipe."""
    with SessionLocal() as db:
        try:
            from backend.recipe_import import Recipe
            
            recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
            if not recipe:
                raise HTTPException(status_code=404, detail="Recipe not found")
            
            # Add photo (implementation depends on actual storage)
            return {"status": "ok", "path": photo_path}
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
