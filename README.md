# Food Webapp

A pastel recipe collection, cooking companion and grocery app. The frontend uses React, Vite and Material UI with small illustrated food icons. FastAPI, SQLAlchemy, SQLite and the existing Docker volume remain unchanged. No external runtime service is required.

## Run

```bash
docker compose up --build -d
```

Open `http://localhost:3000`. Nginx serves the UI and proxies API/photo requests on the same origin. SQLite and photos live in the `backend_data` volume. The API port binds to localhost by default. Do not remove this volume during upgrades.

For local development, use Node 24+ and Python 3.11+ in two terminals:

```bash
# API terminal — use a disposable development database, not your live volume.
python -m pip install -r backend/requirements.txt pytest httpx
PYTHONPATH=backend DATABASE_URL=sqlite:///./dev.db PHOTO_UPLOAD_DIR=./dev-photos \
  python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

```bash
# Frontend terminal
npm ci --prefix frontend
npm run dev --prefix frontend
```

Open the Vite URL printed in the terminal. The dev server proxies `/api` and photo requests to port 8000. Production uses a multi-stage Docker build: Node builds `frontend/dist`, then Nginx serves only the built assets. Legacy `/index.html`, `/lists.html`, `/photos.html` and `/cooking.html?recipe_id=…` links remain valid React routes. No old page scripts or stylesheet are loaded.

To update an existing deployment, pull the approved revision and rebuild the frontend with `docker compose up --build -d frontend`. This UI migration does not change the database schema. Keep the existing `backend_data` volume and proxy/access configuration. HTML revalidates; hashed `/assets/` files use immutable caching so new markup and styles are delivered together.

API documentation is at `/docs` on the backend port. `tests/serve_react.py` serves the actual production build with a disposable API for QA; it is not the production web server. The older `pyproject.toml` console entry point and `tests/serve_ui.py` are historical.

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
npm run test --prefix frontend
npm run build --prefix frontend
```

For full browser/API checks, install test-only browser dependencies and run:

```bash
npm install --prefix .qa playwright
.qa/node_modules/.bin/playwright install chromium
node tests/react_browser.cjs
```

The runner starts its own disposable database/server, tests phone/tablet/desktop, performs mouse/touch/keyboard drag, restarts the server, captures screenshots and runs existing production API checks. Optional `CHROMIUM_EXECUTABLE` and JSON `CHROMIUM_ARGS` choose an existing local test browser. It does not connect to your deployed instance.

Visual preview captures use synthetic, disposable recipes and lists: `node tests/react_preview.cjs`. No sample recipes are shipped as user data. The older vanilla UI browser scripts and evidence are retained as historical records; run the current React suite for this version.

See [React redesign and verification](docs/REACT_REDESIGN.md), [design language](DESIGN.md), and [shared behavior contract](UX-CONTRACT.md). Current screenshots/evidence are in `docs/evidence/react-redesign/`. Previous implementation evidence remains in `docs/evidence/refinement/`.

## Active code and future work

Docker loads `backend/app.py`; the frontend starts at `frontend/src/main.jsx`. `App.jsx` owns routing and API collections. Page components lazy-load recipes, lists, photos and cooking; shared components own editors, dialogs, timers, drag/drop, feedback and export. `theme.js` owns tokens and `styles.css` owns only document-level behavior.

The old HTML pages, scripts and legacy stylesheet were removed after their workflows were replaced by React. The old backend alternatives (`app_new.py`, `app_fixed.py`) remain because historical tests/debug tools still import them. They are not loaded by Docker.

Favorites, recently cooked and personal notes are included. Meal planning, collections, pantry tracking, a versioned JSON restore format, offline/PWA editing and household collaboration remain optional follow-up work. Offline editing requires an explicit sync/conflict design and shared access needs authorization first. The current app reports network failures, keeps quick-add drafts per list and retains failed edits; it does not queue silent offline writes.
