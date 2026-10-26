# Shared behavior

Source: current owner refinement brief and `docs/REFINEMENT.md`; visual contract: `DESIGN.md`.

- Successful writes acknowledge only after API success. API errors preserve forms, show recovery text and remain available for retry.
- Lists use a route (`lists.html?list=ID`), not nested modals. Back returns to the overview. Create opens the saved list. Inline edit Save commits; Cancel discards that edit only.
- Manual order persists in SQLite; filters, category grouping and purchased grouping never write positions. Reorder is available only in the complete manual view. Stale order writes return 409 and require refresh.
- Bulk add uses one transaction and one operation ID across retries. No automatic mutation retries without an idempotency contract. Explicit numeric merge keeps ambiguous input separate.
- Item deletion is soft, with Undo. Clear purchased is soft, with Undo. Whole-list/recipe/photo deletions require an app confirmation.
- Export defaults to remaining items with plain text `[ ]`, optional quantities, manual order. No claim of native Notes checkboxes. Native share only within a click; copy/download fallback always available.
- Cooking progress/timers are device-local, keyed by recipe. Recipe-content changes invalidate checkbox progress. Timers use deadlines and do not promise background alerts.
- No offline write queue or household sync; future work requires an authorization and conflict model. Temporary offline edits remain drafts where feasible.
- Security source: AGENTS.md import/upload restrictions and current owner no-services instruction. No application identity exists; public exposure requires authenticated proxy protection. Live deployment and live data migration are outside this change.

| Capability     | Canonical owner                       | Source of truth              | Allowed variants              | Verification                     |
| -------------- | ------------------------------------- | ---------------------------- | ----------------------------- | -------------------------------- |
| Select/Listbox | Native HTML select                    | main.css / OS popup          | Category, sort, destination   | refinement_browser.cjs           |
| Form           | Labeled HTML form with app validation | ui.js and owning page script | Inline grocery, recipe rows   | test_refinement.py / browser     |
| Scrollbar      | Global CSS baseline                   | main.css canonical tokens    | Document and dialog scroll    | Responsive browser sweep         |
| Toast          | FoodUI.toast                          | ui.js                        | Status, actionable undo       | Delete/undo browser scenario     |
| CRUD           | Page-owned API flows                  | app.py typed schemas         | Grocery route, recipe overlay | Production API and browser tests |
