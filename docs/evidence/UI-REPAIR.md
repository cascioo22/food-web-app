# Food Webapp — UI Repair and QA Report

**Target:** http://host.docker.internal:3000 (user-facing address: http://localhost:3000)
**Verified:** October 20, 2026, UTC
**Scope:** Recipe library/import/edit/delete, grocery lists/items, photos/linking, nutrition, cooking progress, navigation, responsive layouts, Docker persistence.
**Tools:** Chrome MCP, the existing Chrome CDP service via a repeatable Playwright harness, Docker/Compose, HTTP regression tests.

## Executive summary

The running frontend and backend have been rebuilt from this checkout. Core workflows pass real-browser and HTTP verification. No GitHub push or public deployment was performed. Existing working-tree changes, including permission changes, the recipe-library backup and edits to app_new.py, were preserved.

| Severity | Repaired issue groups |
|---|---:|
| Critical | 1 |
| High | 6 |
| Medium | 1 |
| Total | 8 |

- Targeted regression suite: **12 passed** (7 HTTP/API tests, 5 importer tests).
- Browser assertions: **31 desktop + 30 mobile = 61 passed**, zero uncaught JavaScript errors. These counts include repeated checks at different sizes, not 61 independent features.
- Recipe modal geometry checked at 375, 600, 768, 900 and 1280 pixels. Complete workflows also ran from 375px and 1280px viewports.
- Recipe, grocery item, linked-photo metadata and image bytes survived forced recreation of both services.
- `nginx -t`, Python compilation, JavaScript syntax checks, `pip check`, and `git diff --check` passed.
- The older test suite is **not** green: discovery in a disposable container collected 149 tests but stopped with 6 legacy collection errors. It imports outdated models and performs database operations during collection. This was not run against the live database.

## Issues and repairs

### 1. Critical — Database and uploads were not durably configured

**Category:** Functional / deployment

**Reproduction:** Inspect the backend's DATABASE_URL and mounts. The SQLite file was `/app/foodweb.db`, but the named volume was mounted at `/app/data`. Uploads were mounted read-only and the photo code pointed at an unrelated host-style path.

**Expected:** Data and photo files survive container recreation.

**Observed:** The active database was outside the persistent volume; photo writes could not use the intended mounted storage.

**Repair:** Backed up the active database, copied it into the existing named volume, copied the existing upload directory without deleting source files, and configured `sqlite:////app/data/foodweb.db` plus `/app/data/uploads/photos`. Added non-destructive migration for missing recipe columns.

**Evidence:** `ui-repair-persistence-api.txt`. Database integrity returned `ok` before and after migration. The original live database contained no recipe, nutrition, ingredient or photo records. Separate local test databases were inspected but left unchanged.

### 2. High — Recipe empty state, creation and dialogs were broken

**URL:** `/index.html`
**Category:** Functional / UX

**Reproduction:** Open the initially empty library; attempt to add a recipe and click the URL field.

**Expected:** A visible creation control and a dialog that remains open while using its fields.

**Observed:** The library selected the photo gallery's nested `.empty-state` instead of the library state, leaving no usable creation control. Dialog handlers closed on every bubbled click. Status handling replaced form class names. Several handlers referenced variables outside their scope.

**Repair:** Explicit state IDs; an always-available Add Recipe button; explicit manual-entry and close controls; target-aware backdrop handlers; dedicated status elements; consistent dialog state. Nested item-dialog stacking was subsequently corrected after a real pointer-click test caught the form underneath the parent dialog.

**Evidence:** Initial Chrome checks returned `emptyLibraryHasVisibleAddButton: false` and `importModalStaysOpenOnInputClick: false`; both now pass, along with child-dialog and error/retry tests.

### 3. High — Recipe API and UI used incompatible contracts

**URLs:** `/recipes`, `/recipes/manual-entry/save`, `/recipes/import-url`
**Category:** Functional

**Reproduction:** Submit a manual recipe or open/edit a recipe with ingredients and instructions.

**Expected:** Persisted title, ingredients, ordered steps and metadata, plus URL import with review.

**Observed:** Manual-save and import endpoints were absent. Recipe storage/response omitted the UI's fields. Datetime schemas were incompatible with model values. Detail rendering referenced a nonexistent image element. Ingredient bulk-add contained a missing variable and did not persist grocery items.

**Repair:** Added the missing recipe fields and routes, compatible serialization, structured ingredient IDs preserving original lines, persisted bulk-add with duplicate suppression, safe URL fetching and JSON-LD import review. Recipe deletion now cleans nutrition/ingredients and unlinks photos.

**Evidence:** Manual round-trip failed with HTTP 404 before repair. Bulk-add failed with HTTP 500 before repair. Regression and browser suites pass. Live imports returned:

- BBC Good Food Easy pancakes: 6 ingredients, 5 steps.
- Allrecipes Good Old-Fashioned Pancakes: 7 ingredients, 5 steps.

The browser also exercised the live import-to-review form. No third-party recipe content was permanently added during these checks.

### 4. High — Grocery lists and items were effectively stubs

**URL:** `/lists.html`
**Category:** Functional

**Reproduction:** Create/open a list, add an item, rename or check it, then reload.

**Expected:** Independent lists with persistent item CRUD/check-off.

**Observed:** Backend endpoints returned success without storing a list. Frontend item operations wrote only localStorage, list cards did not open an editor, and the UI expected a different response shape.

**Repair:** Real database-backed list/item CRUD, per-list item targeting, functional editor/card controls and persistent check-off/rename/delete operations. Removed false-success local-only persistence.

**Evidence:** List creation initially returned HTTP 200 without an ID. API and real-browser tests now verify creation, edit, completion across reload, rename and deletion.

### 5. High — Photo navigation returned backend JSON instead of HTML

**URL:** `/photos.html`
**Category:** Functional / routing

**Reproduction:** Follow Photos navigation.

**Expected:** HTML gallery page.

**Observed:** Nginx's `/photos` prefix captured `/photos.html`, which the backend returned as a JSON 404.

**Repair:** Boundary-aware API routing, working `/api/` compatibility proxy, explicit uploaded-file proxy and normal static-page handling. Removed immutable caching of unversioned scripts to avoid trapping users on stale broken JavaScript. Added navigation to list and photo pages.

**Evidence:** Chrome MCP now reads HTTP 200 + `text/html` for recipe, list and photo pages, and HTTP 200 JSON for `/health` and `/api/recipes`.

### 6. High — Photo upload, display, edit and recipe association did not agree

**URLs:** `/photos`, `/recipes/{id}/photos`
**Category:** Functional

**Reproduction:** Upload an image from a recipe or the gallery and inspect server results.

**Expected:** Validated image storage, an actual image URL, optional recipe link, editable caption and durable deletion.

**Observed:** Frontend submitted a file while backend required base64. The upload function called an undefined validator and shadowed another upload function. Failure tuples were serialized as HTTP 200 JSON. Listing and rendering expected incompatible fields; recipe photos were placeholders.

**Repair:** Support multipart file and legacy base64 uploads, enforce size/dimension limits, re-encode images without EXIF/location metadata, generate safe filenames and thumbnails, return image URLs and real metadata, and implement caption/link/unlink/delete operations. Gallery failures are no longer presented as successful local-only saves.

**Evidence:** Before repair the upload returned HTTP 200 with `name 'validate_image_data' is not defined`. HTTP and browser tests now upload, retrieve actual image bytes, caption-edit, unlink and delete the fixture.

### 7. High — Cooking progress controls were not usable or isolated

**URL:** `/cooking.html?recipe_id=...`
**Category:** Functional

**Reproduction:** Enter cooking mode, check ingredients/steps, reload and reset.

**Expected:** Reversible completion, all original steps retained, per-recipe persisted progress and correct progress calculation.

**Observed in source:** Click/change handlers were missing; an ingredient update re-rendered with empty text; completed steps were removed and renumbered; steps shared a global storage key; progress counted the wrong elements.

**Repair:** Wired real controls, retained ordered steps, recipe-specific storage, reversible completion, accurate progress, reset, back navigation and keyboard navigation.

**Evidence:** Browser checks verify ingredient and step completion, original step retention, persistence after reload and reset.

### 8. Medium — Nutrition updates could not clear fields and accepted negatives

**URL:** `/recipes/{id}/nutrition`
**Category:** Functional / validation

**Reproduction:** Save a nutrition value, clear it, or submit a negative update.

**Expected:** Clearing optional data persists; invalid values do not overwrite valid data.

**Observed:** Null updates were ignored; updates to existing records skipped validation. Serving size was not set on initial creation.

**Repair:** Validate updates, apply explicitly provided nulls, save serving size, and render missing values distinctly. Opening recipe details is read-only and no longer creates nutrition placeholders.

**Evidence:** Both clearing and negative-update regressions failed before their repair and pass now. Browser nutrition editing also passes.

## Testing coverage and artifacts

### Repeatable commands

```sh
# Live deployed API smoke/regression (creates and cleans its own fixtures)
FOOD_TEST_URL=http://host.docker.internal:3000 python -m unittest discover -s tests -p test_ui_repair_api.py -v

# Browser harness uses existing Chrome, without downloading a second browser
npm install --prefix .qa --legacy-peer-deps --no-audit --no-fund playwright-core
FOOD_LIVE_IMPORT=1 UI_WIDTH=1280 node tests/ui_repair_browser.cjs
UI_WIDTH=375 node tests/ui_repair_browser.cjs

# Local source/build validation
git diff --check
node --check frontend/js/recipe_library.js
node --check frontend/js/lists.js
node --check frontend/js/photos.js
node --check frontend/js/cooking_mode.js
python -m py_compile backend/app.py backend/import_service.py

docker compose -p food-web-app build
docker compose -p food-web-app up -d
docker exec food-web-app-frontend-1 nginx -t
docker exec food-web-app-backend-1 python -m pip check
```

Importer unit tests require the backend dependencies and `backend` on PYTHONPATH. They use synthetic JSON-LD/network fixtures, not fabricated live results. Browser tests use a synthetic 1×1 PNG, so the white image area in the screenshots is expected fixture content. The load-error/retry check deliberately injects one scoped HTTP failure, then restores the real request.

### Evidence files

- `ui-repair-build.txt`
- `ui-repair-regressions.txt`
- `ui-repair-browser.txt`
- `ui-repair-browser-1280.json` and `ui-repair-browser-375.json`
- `ui-repair-persistence-api.txt`
- `ui-repair-legacy-collection.txt`
- `screenshots/ui-repair-1280.png`
- `screenshots/ui-repair-375.png`

All paths above are relative to this report's directory. Absolute report path: `/opt/data/home/food-webapp-project/docs/evidence/UI-REPAIR.md`.

## Remaining limits

- Legacy suite collection errors remain in test_backend_final.py, test_backend_fixed.py, test_backend_fw04.py, test_backend_minimal.py, test_nutrition_save.py and test_nutrition_validation.py. They target old model contracts or operate on uninitialized databases during import. They are not evidence that the new targeted suite is failing, but no full-suite success is claimed.
- Import requires structured Recipe JSON-LD. Sites with unavailable/blocked content or incomplete structured data need manual entry. Fetch failure does not invent a recipe.
- Authentication, public hosting, broad dependency/security upgrades, performance/load testing, exhaustive accessibility and every possible external recipe website were not in scope. The service remains a local-development application.
- The pre-repair backup is `/opt/data/home/food-webapp-project/pre-ui-repair.db`, with another copy in the named volume. No original local database was deleted.
- No QA fixture records remain in the live database. No commits or pushes were made.
