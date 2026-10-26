# Pantry React redesign

## Requested outcome

Replace the uneven, oversized vanilla interface with a cohesive consumer app. The owner's current direction is explicitly **cutesy, light pastel colors, little illustrated food icons**, with less filler text. React + Vite + Material UI is authorized. The existing API, recipes, list IDs/order, photos and nutrition remain authoritative.

## Implemented design

- One compact Pantry header, desktop tabs and mobile bottom navigation. Pages open directly into useful content instead of slogans and large introductions.
- Blush, mint, lavender, butter and peach surfaces; dark text and an accessible rose action color. Rounded Quicksand headings and DM Sans body text are hosted locally.
- A coordinated hand-painted food illustration atlas supplies small decorative icons for the wordmark, list cards, intentional recipe placeholders and empty states. Actual uploaded photos take priority. No fake recipes or stock photos are inserted into the database.
- Grocery rows have aligned checkboxes, names, optional metadata and one overflow menu at a time. Inline editing, a compact add field, shopping display options, search, export, duplication and move/copy remain functional.
- Recipe cards expose the title and useful metadata without large empty image blocks or edit/delete button piles. Detail and editing use pages; instructions and ingredients remain individually editable and ordered.
- Photo previews, gallery editing, recipe covers, optional nutrition, focused/all-step cooking and deadline-based timers are implemented in the React UI.

## Architecture and compatibility

`frontend/src/theme.js` owns Material UI theme tokens. Shared components live under `src/components`, pages under `src/pages`, pure utilities under `src/lib`. MUI owns dialogs, selects, menus, focus behavior and controls. dnd-kit owns mouse/touch/keyboard sorting and named screen-reader announcements; menu movement remains available.

The API, SQLite schema, migration logic and Docker data volume were not changed in this redesign. The React client uses same-origin `/api`; Nginx strips the prefix. All original `.html` UI entry links fall back to the new SPA. Missing hashed assets return 404 rather than HTML. Versioned assets are immutable; HTML revalidates. Docker builds with Node 24 then serves `dist` with Nginx. `package-lock.json` pins dependencies.

Grocery checking updates optimistically with rollback on failure. Bulk-add operation IDs persist across identical retries. Typing the next item while a save is running must not erase that new draft. Recipe edits guard app navigation, browser Back and page unload. Photos and nutrition continue to use existing validation endpoints. No household/offline sync or new authorization model was added.

## Illustration source

- Generated as one original transparent 3×2 food sticker atlas using the built-in image generator.
- Prompt: six separate evenly spaced strawberry, lemon, bread, avocado, noodle bowl and carrot illustrations; soft gouache/colored-pencil cookbook style, pastel palette, warm fine outlines, no faces, lettering, logos, backgrounds or surrounding UI.
- Project asset: `frontend/src/assets/food-illustrations.webp`. This optimized transparent 768×512 WebP is about 108 KB; the production build references a content-hashed copy.
- The unmodified generator output was retained separately in the session. Screenshots uploaded by the owner are reference material and are not committed as app assets.

## Verification

Verified results:

- Production build after clean `npm ci`: passed.
- Frontend utility tests: **6 passed**.
- Backend/migration/import regressions: **14 passed**.
- Existing production HTTP/import regressions: **12 passed**.
- Production-build Chromium scenarios: **36 passed**, with no page JavaScript errors and no horizontal overflow at 393, 768 and 1280px.
- Visual preview sweep: five key screens at each of those widths; zero console/page errors.
- Source formatting and `git diff --check`: passed.

See the raw reports in `docs/evidence/react-redesign/` for commands and actual outcomes. The browser harness runs **production Vite assets**, a disposable SQLite database and the real FastAPI backend, using synthetic records only. Preview screenshots are deliberately separate from mutation-test screenshots.

Commands:

```bash
npm ci --prefix frontend
npm run test --prefix frontend
npm run build --prefix frontend
PYTHONPATH=backend python -m pytest tests/test_refinement.py tests/test_ui_repair_import.py -q
node tests/react_browser.cjs
node tests/react_preview.cjs
```

The renderer can be selected with `CHROMIUM_EXECUTABLE` and JSON `CHROMIUM_ARGS`. Standard Playwright Chromium is the default on a normal developer machine. The current sandbox uses its available headless Chromium binary with software rendering.

The third-party skill static auditor was run. Its remaining findings misclassify six MUI `Select` components as native selects and a MUI `Button href` as an unconnected button. Actual authored popup selection and navigation are runtime behaviors; the ownership map records MUI correctly rather than changing code to match a literal HTML heuristic.

## Boundaries

No live deployment or production-data migration was performed. Real iOS Safari, VoiceOver, native Notes sharing and virtual-keyboard behavior still need physical-device acceptance. Native sharing uses the device sheet where supported; fallback copy/download remains available. Browser timers cannot guarantee background alerts. The historical broad Python suite retains its previously recorded collection errors; repository-wide compilation also encounters an existing indentation error in inactive `backend/app_fixed.py`, while the active API and new QA server compile successfully; current production regression commands are explicit. Docker image execution cannot be claimed unless Docker is available in the test environment.
