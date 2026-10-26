# Food Webapp

A lightweight recipe collection, cooking companion and grocery app. Vanilla HTML/CSS/JavaScript, FastAPI, SQLAlchemy, SQLite and Docker Compose; no frontend build or external service required.

## Run

```bash
docker compose up --build -d
```

Open `http://localhost:3000`. Nginx serves the UI and proxies API/photo requests on the same origin. SQLite and photos live in the `backend_data` volume. The API port binds to localhost by default. Do not remove this volume during upgrades.

For development without Docker:

```bash
python -m pip install -r backend/requirements.txt pytest httpx
PYTHONPATH=tests DATABASE_URL=sqlite:///./dev.db PHOTO_UPLOAD_DIR=./dev-photos \
  python -m uvicorn serve_ui:app --host 127.0.0.1 --port 3000
```

`tests/serve_ui.py` is a development/QA static mount; production continues to use Nginx. API documentation is at `/docs` on the backend port. The `pyproject.toml` console entry point is historical; use the commands above.

## Everyday use

- **Lists:** create a list, type an item and press Enter; paste multiple lines to add them together. Tap a name to edit quantity, unit, category and notes inline. Save/Cancel are explicit. Item removal and clear-purchased offer Undo.
- **Ordering:** use drag handles with mouse/touch, or arrow buttons (item arrows are in the overflow menu). Custom order is stored in SQLite. Reordering is available in the complete manual view; search, category grouping and purchased visibility never rewrite it.
- **Shopping:** use larger shopping controls, hide purchased items or move them to the bottom. Uncheck all resets a recurring shopping trip. Duplicate creates a new list with purchased status reset. Select items in their overflow menus to move/copy them elsewhere.
- **Notes export:** Share / export offers plain text, clipboard, device sharing, `.txt` download and print. Default export includes remaining items and optional quantities, in custom order. Text `[ ]`/`[x]` marks are portable text, not native interactive Notes checkboxes. Unsupported copy/share shows alternatives.
- **Recipes:** search titles, categories, ingredients and notes immediately; sort by newest, title, preparation time, favorites or recently cooked. Import a URL, review/correct it, then save; failed import retains the URL for manual entry. Structured rows support ordering ingredients and instructions without discarding original ingredient wording.
- **Recipe → list:** review all or selected ingredients, optionally adjust serving amounts and create a destination list in the flow. Default keeps duplicates. Explicit numeric merge requires matching names, units, category and notes; ambiguous measurements remain separate. Optional quantity/unit fields let you refine imported wording before transfer.
- **Cooking:** ingredients stay alongside instructions on desktop and above them on phones. Choose all steps or one focused step, navigate previous/next, and check off progress. Progress is local to the browser and recipe; content edits reset stale checkmarks. Multiple labeled timers use persisted deadlines with pause/resume/cancel. A closed/backgrounded browser cannot guarantee notifications or sound.
- **Photos and nutrition:** preview uploads, link photos, edit captions and select a recipe cover. Covers use lazy thumbnails. Uploads are validated, resized and re-encoded without location metadata. Nutrition distinguishes per-serving values from recipe totals; unavailable values stay unavailable.

## Upgrade and data safety

Startup applies **additive SQLite migrations** through `backend/migrations.py`. Before modifying an existing schema it creates a consistent SQLite backup beside the database, named `*.before-refinement-<UTC timestamp>.bak` (mode 0600). Existing IDs/content/completion are retained. Existing list/item positions are initialized from ID order. No populated table is dropped or recreated.

Stop the old service before first upgrade and use one startup worker. Keep a separate backup of the database **and the whole photo directory/volume**, including thumbnails. SQLite backup files alone do not contain images. Check free disk space before upgrading. Migration failure blocks startup instead of silently continuing. The script supports SQLite 3.35+ (including the Docker Python image); other engines need a separately reviewed migration.

To roll back, stop the service, retain a copy of the current database, restore the pre-upgrade SQLite backup at the configured database path, then run the previous app version. Restore the matching photo backup if photos changed after upgrade. Prefer SQLite's backup API or a stopped-service copy; copying a live `.db` without its WAL can lose data. See `docs/BACKUP-RESTORE.md` for older deployment procedures and adapt paths to `DATABASE_URL`/`PHOTO_UPLOAD_DIR`.

Item deletion retains tombstones for Undo. Deleting a whole list permanently deletes its items after confirmation. Bulk-operation receipts preserve safe retry behavior; they and tombstones currently have no automatic expiry. Do not manually purge them while clients may still retry/undo.

## Network and public deployment

There is no application login or household authorization model. Protect **both UI and API routes** using an authenticated reverse proxy (for example Cloudflare Access) before exposing a tunnel. CORS is empty/same-origin by default; `CORS_ORIGINS` is an opt-in comma-separated allowlist for a separate trusted frontend. CORS is not authentication. No live deployment or production database migration is part of this change.

Recipe fetching retains public-IP validation, redirect revalidation, response-size limits and timeouts. Photo uploads retain content validation and EXIF stripping. No accounts, paid APIs, AI services or trackers were added.

## Verify

The broad historical suite has pre-existing collection failures and contains embedded alternative apps. Production regression commands are explicit so those unrelated implementations cannot be mistaken for application coverage:

```bash
PYTHONPATH=backend python -m pytest tests/test_refinement.py tests/test_ui_repair_import.py -q
node tests/refinement_pure.cjs
```

For full browser/API checks, install test-only browser dependencies and run:

```bash
npm install --prefix .qa playwright
.qa/node_modules/.bin/playwright install chromium
node tests/refinement_browser.cjs
```

The runner starts its own disposable database/server, tests phone/tablet/desktop, performs mouse/touch/keyboard drag, restarts the server, captures screenshots and runs existing production API checks. Optional `CHROMIUM_EXECUTABLE` and JSON `CHROMIUM_ARGS` choose an existing local test browser. It does not connect to your deployed instance.

Before captures can be reproduced with `git worktree add ../food-before fe966661`, then `node tests/capture_before.cjs`; override `FOOD_BEFORE_ROOT` if the worktree is elsewhere. Baseline fixtures are synthetic test records only.

See [implementation inventory and decisions](docs/REFINEMENT.md), [verification report](docs/REFINEMENT_REPORT.md), [design language](DESIGN.md), and [shared behavior contract](UX-CONTRACT.md). Raw evidence and before/after screenshots are in `docs/evidence/refinement/`.

## Active code and future work

Docker loads `backend/app.py`; HTML loads `recipe_library.js`, `lists.js`, `photos.js`, `cooking_mode.js` and shared helpers. `main.js`, `recipe_library_fixed.js`, `app_new.py` and `app_fixed.py` are historical and are not loaded by active pages/containers. Some old tests/tools still import them, so they have deliberately not been deleted under this refinement.

Favorites, recently cooked and personal notes are included. Meal planning, collections, pantry tracking, a versioned JSON restore format, offline/PWA editing and household collaboration remain optional follow-up work. Offline editing requires an explicit sync/conflict design and shared access needs authorization first. The current app reports network failures, keeps quick-add drafts per list and retains failed edits; it does not queue silent offline writes.
