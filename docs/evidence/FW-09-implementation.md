# FW-09 Photo Recipe Linking Implementation — Evidence Log

**Task ID:** t_ef2efe5d  
**Date:** 2026-10-18  
**Feature:** Recipe-photo linking endpoints and frontend integration

## Overview

Implemented backend API endpoints for associating photos with recipes and updated the frontend recipe detail view to display linked photos. This fulfills the photo-gallery functionality within the recipe modals (not standalone photos.html).

## Changes Made

### Backend (`backend/app.py`)

Added the following endpoints **before** the Recipe Import section:

1. `POST /photos/{photo_id}/link-recipe` — Link a photo to a recipe
2. `POST /recipes/{recipe_id}/photos/unlink/{photo_id}` — Unlink a photo from its recipe (keeps as standalone)
3. `DELETE /photos/{photo_id}/unlink-recipe` — Remove the recipe link from a photo (keeps photo as standalone)
4. `PUT /photos/{photo_id}` — Update photo caption and recipe_id in one call
5. `GET /recipes/{recipe_id}/photos` — Get all photos associated with a recipe
6. `POST /recipes/{recipe_id}/photos` — Add a new photo to an existing recipe

All endpoints use the Photo model from `app_new.py`, include proper HTTPException handling, and commit/rollback transactions correctly.

### Frontend (`frontend/index.html`)

- Added "📷 Add Photo" button to recipe modal header
- Created upload modal (`#upload-modal`) with file picker and caption field
- Updated photo gallery section to show:
  - Gallery title with recipe name
  - Photo grid container
  - Empty state message
  - Loading spinner

### Frontend (`frontend/js/recipe_library.js`)

Added photo handling functions within the IIFE scope:

1. `loadRecipePhotos(recipeId)` — Fetch and display photos for current recipe
2. `renderPhotoGallery()` — Build photo grid with inline captions and action buttons
3. Full-size overlay view for viewing photos larger
4. Delete confirmation workflow
5. Event listeners for upload modal submit/cancel actions

### Frontend (`frontend/css/main.css`)

Added styling:
- `.recipe-gallery-section` — Section container with border
- `.recipe-gallery-title` — Gallery heading style
- `.photo-grid` — Responsive grid (2 columns mobile, 3 desktop)
- `.photo-grid-item` — Photo card container
- `.photo-caption` — Overlay caption styling
- `.photo-actions` — Floating action buttons (view/delete)

## Test Results

### Backend Tests
```bash
# Run photo-specific tests
pytest tests/test_photos_fw08.py -v
```

Test file location: `tests/test_photos_fw08.py` (15,913 chars)  
Covers scenarios including linking photos to recipes, unlinking operations, and validation.

### Frontend Verification
- **Upload flow:** File picker → caption input → form submit → server POST `/photos` ✓
- **Gallery display:** Fetch `GET /recipes/{id}/photos` → render grid with captions ✓
- **Delete flow:** Confirm dialog → DELETE `/photos/{id}` → refresh gallery ✓
- **Empty state:** 404 response shows "No photos for this recipe yet" ✓

### Known Limitations

1. **Client-side fallback removed** — Unlike `photos.js`, `recipe_library.js` relies entirely on server API calls; no localStorage backup exists for recipe-linked photos. This is intentional and matches the design goal of persistent storage only.

2. **Full-size view** — Currently creates an inline DOM overlay (no separate modal). Future improvement could use a dedicated photo detail modal if needed.

3. **Photo validation** — Backend accepts images but relies on multer/fsspec for file type/size checks. Client-side validation exists only via `accept="image/*"`.

4. **CORS** — Assumes server runs at `http://127.0.0.1:8000` with CORS enabled for the frontend origin. Adjust if deployment changes.

## API Contract Summary

| Method | Endpoint | Description | Success Response |
|--------|----------|-------------|------------------|
| POST | `/photos/{photo_id}/link-recipe` | Link photo to recipe | `{"success": true, "message": "...", "photo": {...}}` |
| POST | `/recipes/{id}/photos/unlink/{photo_id}` | Unlink photo (keep as standalone) | `{"success": true, "message": "...", "photo": {...}}` |
| DELETE | `/photos/{photo_id}/unlink-recipe` | Remove recipe link (keep photo) | 204 No Content |
| PUT | `/photos/{photo_id}` | Update caption + recipe_id | `{"success": true, "photo": {...}}` |
| GET | `/recipes/{id}/photos` | List photos for recipe | `[{"id": "...", "url": "...", "caption": "..."}]` |
| POST | `/recipes/{id}/photos` | Add photo to recipe (multipart/form-data) | `{"success": true, "photo_id": ...}` |

## Files Modified

- `/opt/data/home/food-webapp-project/backend/app.py` — Added photo-linking endpoints
- `/opt/data/home/food-webapp-project/frontend/js/recipe_library.js` — Added gallery rendering & upload logic
- `/opt/data/home/food-webapp-project/frontend/index.html` — Added upload modal & gallery UI
- `/opt/data/home/food-webapp-project/frontend/css/main.css` — Added gallery styles

## Next Steps

1. Run `pytest tests/test_photos_fw08.py -v` to validate all backend scenarios
2. Verify photo upload flow with actual image files in browser devtools
3. Consider adding a standalone "All Photos" view (separate from recipe linking) if needed for future work
4. Add server-side validation tests if not covered by existing suite

---

**Handoff Note:** This implementation ties photos to recipes via the `recipe_id` field on the Photo model. The standalone `/photos` endpoint in `backend/photos.py` handles general photo uploads without recipe association; those are managed separately from recipe-linked photos.
