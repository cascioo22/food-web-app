@app.get("/grocery-lists", response_model=List[GroceryListResponse])
def list_grocery_lists(db: Session = Depends(get_db)):
    try:
        lists = db.query(GroceryList).all()
        result = [
            {**l.__dict__, "created_at": l.created_at.isoformat() if l.created_at else None}
            for l in lists
        ]
        return result
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")


@app.post("/grocery-lists", response_model=GroceryListResponse, status_code=201)
def create_grocery_list(list_data: GroceryListCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(GroceryList).filter(GroceryList.name == list_data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Grocery list with this name already exists")
        db_list = GroceryList(name=list_data.name, items='[]')
        db.add(db_list)
        db.commit()
        db.refresh(db_list)
        result = {**db_list.__dict__, "created_at": db_list.created_at.isoformat() if db_list.created_at else None}
        return result
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error")


@app.get("/grocery-lists/{list_id}")
def get_grocery_list(list_id: int, db: Session = Depends(get_db)):
    try:
        list_item = db.query(GroceryList).filter(GroceryList.id == list_id).first()
        if not list_item:
            raise HTTPException(status_code=404, detail="Grocery list not found")
        return list_item
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")


@app.patch("/grocery-lists/{list_id}")
def update_grocery_list(list_id: int, items_data: List[dict], db: Session = Depends(get_db)):
    try:
        list_item = db.query(GroceryList).filter(GroceryList.id == list_id).first()
        if not list_item:
            raise HTTPException(status_code=404, detail="Grocery list not found")
        import json
        list_item.items = json.dumps(items_data)
        db.commit()
        return {"message": "Grocery list updated"}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error")


@app.delete("/grocery-lists/{list_id}")
def delete_grocery_list(list_id: int, db: Session = Depends(get_db)):
    try:
        list_item = db.query(GroceryList).filter(GroceryList.id == list_id).first()
        if not list_item:
            raise HTTPException(status_code=404, detail="Grocery list not found")
        db.delete(list_item)
        db.commit()
        return {"message": "Grocery list deleted"}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error")


@app.get("/photos", response_model=List[PhotoResponse])
def list_photos(recipe_id: int = None, db: Session = Depends(get_db)):
    try:
        photos = db.query(Photo).filter(Photo.recipe_id == recipe_id) if recipe_id else db.query(Photo).all()
        return [{**p.__dict__, "created_at": p.created_at.isoformat() if p.created_at else None} for p in photos]
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")


@app.post("/photos", response_model=PhotoResponse, status_code=201)
def add_photo(photo_data: dict, db: Session = Depends(get_db)):
    try:
        import uuid
        filename = f"{uuid.uuid4()}.png"
        db_photo = Photo(filename=filename, data_url=photo_data.get("data_url"), recipe_id=photo_data.get("recipe_id"))
        db_photo.caption = photo_data.get("caption", "")
        db.add(db_photo)
        db.commit()
        db.refresh(db_photo)
        return db_photo
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")


@app.delete("/photos/{photo_id}")
def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    try:
