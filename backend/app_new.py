"""Food Webapp FastAPI backend with recipe and nutrition support."""
from fastapi import FastAPI, Depends, HTTPException, status, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, TYPE_CHECKING
from contextlib import contextmanager

if TYPE_CHECKING:
    from pydantic.main import BaseModel

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, func, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

import sys
import os

# Add the project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    created_at = Column(DateTime, default_factory=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default_factory=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
    
    created_at = Column(DateTime, default_factory=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default_factory=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


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
    created_at = Column(DateTime, default_factory=lambda: datetime.now(timezone.utc))


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
            from app_new import Photo as PhotoModel
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
            from app_new import Photo as PhotoModel
            to_delete = db.query(PhotoModel).filter_by(filename=filename).first()
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
    
    query = db.query(PhotoModel)
    if recipe_id:
        query = query.filter_by(recipe_id=recipe_id)
    
    photos = query.order_by(PhotoModel.created_at.desc()).limit(limit).all()
    
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
    with SessionLocal() as db:
        # Include nutrition if it exists
        recipes = []
        for recipe in db.query(Recipe).all():
            recipe_obj = RecipeResponse.model_validate(recipe)
            
            # Try to include nutrition
            try:
                from backend.app_new import NutritionResponse
                nutrition = db.query(Nutrition).filter(Nutrition.recipe_id == recipe.id).first()
                if nutrition:
                    recipe_obj.nutrition = NutritionResponse.model_validate(nutrition)
            except Exception as e:
                print(f"Error attaching nutrition to recipe {recipe.id}: {type(e).__name__}: {e}")
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
            from backend.app_new import NutritionResponse
            nutrition = db.query(Nutrition).filter(Nutrition.recipe_id == recipe.id).first()
            if nutrition:
                result.nutrition = NutritionResponse.model_validate(nutrition)
        except Exception as e:
            print(f"Error attaching nutrition to recipe {recipe_id}: {type(e).__name__}: {e}")
            pass
        
        return result


@app.post("/recipes", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(recipe_data: dict):
    """Create a new recipe from imported data."""
    with SessionLocal() as db:
        try:
            # DEBUG: Log incoming request
            import json as json_module
            print(f"[DEBUG create_recipe] Incoming data: {json_module.dumps(recipe_data, indent=2)[:500]}")
            
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
            
            # Try to extract nutrition from the imported HTML if URL was provided
            extracted_nutrition = None
            if url and not manual_entry:
                try:
                    import sys
                    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                    from backend.recipe_import import extract_nutrition_json_ld, BeautifulSoup
                    
                    soup = BeautifulSoup(recipe_data.get('html_content', ''), 'html.parser') if recipe_data.get('html_content') else None
                    if soup:
                        extracted_nutrition = extract_nutrition_json_ld(soup)
                except Exception as e:
                    # Non-fatal error - continue without nutrition
                    pass
            
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
            
            # If we have extracted nutrition, save it to the Nutrition table
            if extracted_nutrition:
                try:
                    from backend.app_new import Nutrition, validate_nutrition_data, NutritionCreate
                    
                    # Validate and create nutrition record
                    nutrition_validation = validate_nutrition_data(NutritionCreate(**extracted_nutrition))
                    if nutrition_validation["valid"]:
                        nutrition_record = Nutrition(recipe_id=db_recipe.id)
                        nutrition_data = NutritionCreate(**extracted_nutrition)
                        
                        # Set per-serving values only if they're not None
                        if nutrition_data.calories_per_serving is not None:
                            nutrition_record.calories_per_serving = nutrition_data.calories_per_serving
                        if nutrition_data.protein_per_serving is not None:
                            nutrition_record.protein_per_serving = nutrition_data.protein_per_serving
                        if nutrition_data.carbohydrates_per_serving is not None:
                            nutrition_record.carbohydrates_per_serving = nutrition_data.carbohydrates_per_serving
                        if nutrition_data.fat_per_serving is not None:
                            nutrition_record.fat_per_serving = nutrition_data.fat_per_serving
                        if nutrition_data.fiber_per_serving is not None:
                            nutrition_record.fiber_per_serving = nutrition_data.fiber_per_serving
                        if nutrition_data.sugar_per_serving is not None:
                            nutrition_record.sugar_per_serving = nutrition_data.sugar_per_serving
                        if nutrition_data.sodium_per_serving is not None:
                            nutrition_record.sodium_per_serving = nutrition_data.sodium_per_serving
                        
                        # Set total values only if they're not None
                        if nutrition_data.calories_total is not None:
                            nutrition_record.calories_total = nutrition_data.calories_total
                        if nutrition_data.protein_total is not None:
                            nutrition_record.protein_total = nutrition_data.protein_total
                        if nutrition_data.carbohydrates_total is not None:
                            nutrition_record.carbohydrates_total = nutrition_data.carbohydrates_total
                        if nutrition_data.fat_total is not None:
                            nutrition_record.fat_total = nutrition_data.fat_total
                        if nutrition_data.fiber_total is not None:
                            nutrition_record.fiber_total = nutrition_data.fiber_total
                        if nutrition_data.sugar_total is not None:
                            nutrition_record.sugar_total = nutrition_data.sugar_total
                        if nutrition_data.sodium_total is not None:
                            nutrition_record.sodium_total = nutrition_data.sodium_total
                        
                        db.add(nutrition_record)
                        db.commit()
                except Exception as e:
                    # Non-fatal error - continue without saving nutrition
                    db.rollback()
            
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
