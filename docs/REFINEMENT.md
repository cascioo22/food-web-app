# Refinement implementation inventory

Baseline: upstream `fe966661` (2026-10-25). Architecture remains vanilla JS, FastAPI, SQLAlchemy and SQLite. This document distinguishes inspected implementation from verified behavior; final evidence lives in `docs/evidence/refinement`.

| Feature                          | Initial classification       | Active owner / dependencies                                                                                                         |
| -------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| List/item CRUD                   | Working but requiring polish | lists.html, lists.js, app.py; production API regression tests                                                                       |
| Persistent reordering            | Missing                      | no position columns, ID ordering only                                                                                               |
| Shopping, bulk entry, export     | Missing                      | lists.js; checkboxes exist but modal-based                                                                                          |
| Recipe editor and import preview | Working but requiring polish | index.html, recipe_library.js, import_service.py; plain text editors                                                                |
| Recipe search and card imagery   | Missing                      | recipe_library.js ignores library discovery controls; cards always placeholders                                                     |
| Recipe-to-list transfer          | Partially implemented        | app.py silently skips duplicates, picker needs existing lists                                                                       |
| Cooking progress                 | Working but requiring polish | cooking_mode.js, localStorage by recipe; no content fingerprint                                                                     |
| Cooking timers                   | Missing                      | no timer implementation                                                                                                             |
| Photo/nutrition CRUD             | Working but requiring polish | active app.py endpoints, photos.js; validation and EXIF stripping exist                                                             |
| Public deployment access         | Unverified                   | compose + optional Cloudflare tunnel; no application authentication                                                                 |
| Legacy implementations           | Duplicated                   | app_new.py, app_fixed.py, main.js, recipe_library_fixed.js; not loaded by active HTML/Docker, but some historical tests import them |
| Test suite                       | Broken collection            | broad pytest run: 10 collection errors; legacy tests embed different apps or require live servers                                   |

## Milestones

1. P0: additive backed-up migration, transaction-safe ordering, idempotent bulk add, direct list detail, inline item editing, shopping controls, text/copy/share export, pointer + keyboard ordering, deletion undo.
2. P0: common tokens, status/confirmation/dialog primitives, mobile layout and navigation, resilient forms.
3. P1: library discovery, structured editing, import correction, scaling and grocery transfer.
4. P1: cooking progression/timers, covers/photo preview, nutrition clarity.
5. P2: favorites/notes/recently cooked and documented portability/offline/collaboration boundaries. Meal planning and pantry should remain future scope until core QA is complete.

## Data decisions

- Manual order is independent of completed status, search and category view. Reorder controls operate only in unfiltered manual view.
- Existing rows receive deterministic ID order. SQLite backup uses its online backup API before any ALTER; tables are never dropped/recreated.
- Item removal retains a tombstone for restoration. Whole-list deletion is permanent and requires explicit application confirmation.
- Bulk additions default to keeping intentional duplicates. Explicit merge combines only nonnegative finite numeric quantities with identical units/category/notes. Ambiguous measurements remain separate.
- Ordering uses compare-and-swap revisions; all SQLite mutation read/write sequences use BEGIN IMMEDIATE. Bulk retries use operation receipts to avoid duplicate insertion after a lost response.
- Application has no household identity/authorization model. Do not expose it publicly without an authenticated reverse proxy such as Cloudflare Access. No hosting or live database changes performed here.

## Final implementation notes

Active grocery operations now include `/grocery-lists/order`, `/{id}/items/order`, `/{id}/items/bulk`, `/{id}/restore`, `/{id}/duplicate`, `/{id}/reset`, `/{id}/clear-completed`, and `/{id}/transfer`. List revisions and item versions reject stale supported mutations. Ordinary writes and reordering serialize SQLite read-modify-write sequences. The legacy recipe-to-list endpoint remains compatible with older clients; the new UI uses the explicit duplicate-policy bulk endpoint.

The current browser runner proves actual server restart persistence, pointer events from mouse and touch, keyboard movement, failed-submit recovery, deletion undo, form ordering, import correction, scaling, covers, nutrition and timers. It uses synthetic data and a disposable database only.

P2 assessment: favorites, notes and recently cooked add value using small fields on Recipe and reuse the current library. List duplication supplies recurring-list reuse without a separate templates model. A planner/pantry/collections system would add new navigation and maintenance obligations, so these are deferred. SQLite+photos backups are restorable today; a portable versioned JSON restore flow needs reference remapping, conflict/replace rules and image packaging. PWA read caches are plausible, but writes require a durable mutation queue plus conflict handling. Household sync requires identities and permissions before expanding the current trusted-proxy model.
