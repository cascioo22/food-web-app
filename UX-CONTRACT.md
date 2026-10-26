# Pantry interaction contract

Visual authority: [DESIGN.md](DESIGN.md). The owner's current direction explicitly authorizes React, Vite and Material UI, pastel colors and food illustrations. The existing FastAPI/SQLite data contracts remain authoritative.

| Capability     | Canonical owner                                    | Source of truth                         | Allowed variants                                     | Verification                                       |
| -------------- | -------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Select/Listbox | Material UI Select, authored popup                 | MUI 9; theme.js                         | Filters, category, destination                       | Real popup selection in react_browser.cjs          |
| Form           | MUI TextField with explicit application validation | API schemas, RecipeEditor, page actions | Inline grocery; page recipe editor; upload dialog    | Failed-save retention and form CRUD browser checks |
| Scrollbar      | Document CSS baseline                              | styles.css                              | Document, menu and dialog overflow                   | Responsive and reduced-motion sweep                |
| Toast          | UIProvider Snackbar/Alert                          | components/UI.jsx                       | Success/error, persistent Undo                       | Delete/undo and error recovery checks              |
| CRUD           | API + per-screen transactions                      | backend/app.py                          | Full page details, inline item changes, photo dialog | Backend and production-build browser suites        |

- Same operation uses the same control family and vocabulary throughout the app. Success is reported only after the server confirms the write. Failed forms stay editable.
- Recipes and grocery details use routes; the existing `.html` URLs remain valid. Recipe editing is a page, with unsaved-change guards for app navigation, browser Back, and page unload.
- Only one overflow menu opens at a time. MUI owns dialog/menu focus, Escape and return focus. Native confirmation is used only for actual browser unload; app confirmation uses a MUI dialog.
- The complete manual item order is authoritative. Category grouping, search and purchased visibility are display-only. Pointer/touch/keyboard dragging uses dnd-kit; move-up/down menu items provide another accessible path.
- Grocery checking updates immediately, then saves; failures roll back visibly. Bulk additions retain an operation ID across identical retries. Input typed while a save is in flight must not be erased by that save.
- Deleting one item or clearing purchased items offers backend-backed Undo. Whole lists, recipes and photos require confirmation before permanent deletion.
- Export defaults to remaining items, quantities and canonical order, with plain text `[ ]` marks. Copy, native share, text download and print work independently. No direct Notes integration is claimed.
- Cooking progress and timers stay device-local and recipe-specific. Content changes invalidate checkbox progress; timers use absolute deadlines, with no promise of background notifications.
- No identity, sync model, PWA write queue, external analytics or paid service was added. All live data and access controls remain on the owner's existing backend/deployment.
