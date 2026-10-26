# Recipe alignment and meal categories

- Recipe-card ButtonBase now uses flex-start, so tiles and text keep a consistent left inset regardless of title length.
- The editor/filter use Breakfast, Lunch, Dinner and Dessert, with an unset option. Recognized imported aliases map deterministically; the first recognized category wins. Unknown categories are left unclassified rather than guessed. Existing raw category values remain unchanged on unrelated edits; selecting a meal category explicitly replaces them. No database migration or data rewrite.
- Uploaded cover images still take priority. Otherwise the local illustrated atlas uses bread, avocado, bowl and strawberry for the respective meal categories, instead of record-ID-based random icons. No external image API, tracking or unreliable remote assets.

Validation:

- `npm run test --prefix frontend`: 7 passed.
- `npm run build --prefix frontend`: passed.
- `CHROMIUM_EXECUTABLE=/tmp/chromium node tests/meal_categories_browser.cjs`: passed. Actual built frontend with mocked API: left insets and no overflow at 393/768/1280px, open filter/editor Select options, imported alias filtering, legacy category preservation during unrelated edits, explicit category save, no page errors. Screenshots beside this file.
- `git diff --check`: passed.
- Strict premium audit: 8 known false positives (7 MUI authored Select components misread as native select; 1 existing MUI href Button misread as actionless). The new category Select is imported from MUI and its authored popup is browser-tested. No native select was introduced. Raw report retained.

Backend APIs and schema unchanged. Physical Safari/device verification and live deployment were not performed.
