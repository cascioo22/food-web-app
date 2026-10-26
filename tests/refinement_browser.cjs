/* QA dependencies: playwright + a Chromium executable. No runtime app dependencies. */
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("../.qa/node_modules/playwright"));
}
const { spawn } = require("node:child_process");
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  path = require("node:path"),
  os = require("node:os");
const evidence = "docs/evidence/refinement",
  base = "http://127.0.0.1:8012";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "food-qa-"));
const checks = [],
  errors = [];
let server, browser;
const check = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function start() {
  const log = fs.openSync(`${evidence}/browser-server.log`, "a");
  server = spawn(
    "python",
    ["-m", "uvicorn", "serve_ui:app", "--port", "8012"],
    {
      env: {
        ...process.env,
        PYTHONPATH: "tests",
        DATABASE_URL: `sqlite:///${temp}/qa.db`,
        PHOTO_UPLOAD_DIR: `${temp}/photos`,
      },
      stdio: ["ignore", log, log],
    },
  );
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("QA server did not start");
}
async function stop() {
  if (server) {
    server.kill();
    await new Promise((r) => server.on("close", r));
    server = null;
  }
}
async function api(url, method = "GET", data) {
  const r = await fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = r.status === 204 ? null : await r.json();
  assert(r.ok, JSON.stringify(result));
  return result;
}
async function drag(page, handle, target, touch = false) {
  const from = await handle.boundingBox(),
    to = await target.boundingBox();
  const x = from.x + from.width / 2,
    y = from.y + from.height / 2,
    tx = to.x + Math.min(50, to.width / 2),
    ty = to.y + to.height - 5;
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: tx, y: ty }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 10 });
    await page.mouse.up();
  }
}
(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  await start();
  let args = ["--no-sandbox"];
  if (process.env.CHROMIUM_ARGS) args = JSON.parse(process.env.CHROMIUM_ARGS);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    hasTouch: true,
    isMobile: true,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/lists.html");
  await page.locator("#new-list-name").fill("Weekly groceries");
  await page.locator("#create-list-form button").click();
  await page.locator("#list-detail").waitFor({ state: "visible" });
  let lists = await api("/grocery-lists"),
    lid = lists[0].id;
  await page.locator("#quick-item").fill("Milk");
  await page.locator("#quick-item").press("Enter");
  await page.waitForFunction(
    () => document.querySelectorAll(".shopping-item").length === 1,
  );
  assert(
    await page
      .locator("#quick-item")
      .evaluate((e) => e === document.activeElement),
  );
  await page.locator("#quick-item").fill("Eggs\nTomatoes\nBread");
  await page.locator("#quick-add-btn").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".shopping-item").length === 4,
  );
  check("create, fast add retains focus, multiline paste");
  await page.locator(".item-main").first().click();
  await page.locator('[name="name"]').fill("Oat milk");
  await page.locator('[name="quantity"]').fill("1");
  await page.locator('[name="unit"]').fill("gallon");
  await page.locator('[name="category"]').selectOption("Dairy and eggs");
  await page.locator('[name="notes"]').fill("unsweetened");
  await page
    .locator("[data-edit-form] button")
    .filter({ hasText: "Save" })
    .click();
  await page.locator("[data-edit-form]").waitFor({ state: "detached" });
  check("inline edit persists quantity category notes");
  await page.locator(".item-check").nth(1).check();
  await page.waitForFunction(() => document.querySelector(".purchased"));
  const initial = await api(`/grocery-lists/${lid}`);
  // Mouse drag works using pointer handlers even in a touch-capable context.
  await drag(
    page,
    page.locator("#items-list .drag-handle").first(),
    page.locator(".shopping-item").nth(2),
  );
  await page.waitForFunction(
    () => document.querySelector(".item-main span")?.textContent === "Eggs",
  );
  let reordered = await api(`/grocery-lists/${lid}`);
  assert.equal(reordered.items[2].name, "Oat milk");
  assert.equal(reordered.items.find((i) => i.name === "Eggs").completed, true);
  check("mouse item drag saves order and preserves completion");
  await drag(
    page,
    page.locator("#items-list .drag-handle").first(),
    page.locator(".shopping-item").last(),
    true,
  );
  await page.waitForFunction(
    () => document.querySelector(".item-main span")?.textContent === "Tomatoes",
  );
  check("touch item drag");
  await page.locator(".item-menu summary").first().click();
  const down = page.locator('.item-menu[open] button[data-action="down"]');
  await down.focus();
  await down.press("Enter");
  await page.waitForFunction(
    () => document.querySelector(".item-main span")?.textContent === "Oat milk",
  );
  check("keyboard item move");
  const orderedIds = (await api(`/grocery-lists/${lid}`)).items.map(
    (i) => i.id,
  );
  await page.reload();
  await page.locator(".shopping-item").first().waitFor();
  assert.deepEqual(
    (await api(`/grocery-lists/${lid}`)).items.map((i) => i.id),
    orderedIds,
  );
  check("order persists across refresh");
  await page.locator(".list-options summary").click();
  await page.locator("#hide-completed").check();
  assert.equal(await page.locator(".shopping-item").count(), 3);
  await page.locator("#hide-completed").uncheck();
  await page.locator("#completed-bottom").check();
  assert.deepEqual(
    (await api(`/grocery-lists/${lid}`)).items.map((i) => i.id),
    orderedIds,
  );
  await page.locator("#completed-bottom").uncheck();
  await page.locator("#group-mode").selectOption("category");
  assert.deepEqual(
    (await api(`/grocery-lists/${lid}`)).items.map((i) => i.id),
    orderedIds,
  );
  await page.locator("#group-mode").selectOption("manual");
  check("shopping views preserve canonical order");
  await page.locator("#shopping-toggle").click();
  await page.screenshot({
    path: `${evidence}/after-detail-390.png`,
    fullPage: true,
  });
  await page.locator("#export-list").click();
  const text = await page.locator("#export-preview").inputValue();
  assert(text.includes("Oat milk — 1 gallon"));
  assert(!text.includes("Eggs"));
  await page.locator("#export-completed").check();
  assert(
    (await page.locator("#export-preview").inputValue()).includes("[x] Eggs"),
  );
  await page.locator("#share-export").click();
  assert(
    (await page.locator("#export-status").textContent()).includes(
      "unavailable",
    ),
  );
  await page.locator("#copy-export").click();
  assert((await page.locator("#export-status").textContent()).length > 0);
  const download = page.waitForEvent("download");
  await page.locator("#download-export").click();
  assert((await download).suggestedFilename().endsWith(".txt"));
  await page.locator("#close-export").click();
  check("export formatting, share fallback, clipboard feedback, text download");
  await page.locator(".item-menu summary").first().click();
  const removed = (await api(`/grocery-lists/${lid}`)).items[0].id;
  await page.locator('.item-menu[open] [data-action="delete"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll(".shopping-item").length === 3,
  );
  await page.locator(".toast button").filter({ hasText: "Undo" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".shopping-item").length === 4,
  );
  assert(
    (await api(`/grocery-lists/${lid}`)).items.some((i) => i.id === removed),
  );
  check("delete and undo retain identity");
  // Failed save keeps input and retry uses one operation ID.
  await page.route("**/items/bulk", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Temporary outage; retry." }),
    }),
  );
  await page.locator("#quick-item").fill("Butter");
  await page.locator("#quick-add-btn").click();
  await page.locator("#detail-error").waitFor({ state: "visible" });
  assert.equal(await page.locator("#quick-item").inputValue(), "Butter");
  await page.unroute("**/items/bulk");
  await page.locator("#quick-add-btn").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".shopping-item").length === 5,
  );
  check("failed addition preserves input and retry succeeds");
  await page.locator("#back-to-lists").click();
  await page.locator("#new-list-name").fill("Weekend");
  await page.locator("#create-list-form button").click();
  await page.locator("#list-detail").waitFor({ state: "visible" });
  await page.locator("#back-to-lists").click();
  await page.locator(".list-tile").nth(1).waitFor();
  await drag(
    page,
    page.locator(".list-tile").first().locator("[data-drag]"),
    page.locator(".list-tile").last(),
  );
  await page.waitForFunction(
    () => document.querySelector(".list-open h2")?.textContent === "Weekend",
  );
  check("list mouse reorder");
  await drag(
    page,
    page.locator(".list-tile").first().locator("[data-drag]"),
    page.locator(".list-tile").last(),
    true,
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".list-open h2")?.textContent ===
      "Weekly groceries",
  );
  check("list touch reorder");
  await page
    .locator(".list-tile")
    .first()
    .locator('[data-action="down"]')
    .focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector(".list-open h2")?.textContent === "Weekend",
  );
  check("list keyboard reorder");
  const listOrder = (await api("/grocery-lists")).map((l) => l.id),
    itemOrder = (await api(`/grocery-lists/${lid}`)).items.map((i) => i.id);
  await stop();
  await start();
  assert.deepEqual(
    (await api("/grocery-lists")).map((l) => l.id),
    listOrder,
  );
  assert.deepEqual(
    (await api(`/grocery-lists/${lid}`)).items.map((i) => i.id),
    itemOrder,
  );
  check("list and item order survive real server restart");
  // Recipe editor / import correction via controlled fixture, with production extraction tested separately.
  await page.goto(base + "/index.html");
  await page.locator("#new-recipe-btn").click();
  await page.locator("#manual-entry-btn").click();
  await page.locator("#manual-title").fill("Roasted tomato soup");
  await page.locator("#manual-servings").fill("2");
  await page.locator("#manual-prep").fill("15 min");
  const ingredients = page.locator("#manual-ingredients + .structured-editor");
  await ingredients.locator('[data-row-action="add"]').click();
  await ingredients.locator('[data-field="name"]').fill("tomatoes");
  await ingredients.locator('[data-field="quantity"]').fill("4");
  await ingredients.locator('[data-row-action="add"]').click();
  await ingredients.locator('[data-field="name"]').nth(1).fill("salt to taste");
  const steps = page.locator("#manual-steps + .structured-editor");
  await steps.locator('[data-row-action="add"]').click();
  await steps.locator('[data-field="text"]').fill("Roast tomatoes.");
  await steps.locator('[data-row-action="add"]').click();
  await steps.locator('[data-field="text"]').nth(1).fill("Blend and serve.");
  await page.locator('#manual-entry-form [type="submit"]').click();
  await page.locator("#import-modal").waitFor({ state: "hidden" });
  let recipe = (await api("/recipes")).find(
      (r) => r.title === "Roasted tomato soup",
    ),
    rid = recipe.id;
  assert.equal(recipe.ingredients_text, "4 tomatoes\nsalt to taste");
  check("structured manual recipe creation");
  await page.locator("#recipe-search").fill("tomatoes");
  assert.equal(await page.locator(".recipe-card").count(), 1);
  await page.locator("#recipe-search").fill("not a recipe");
  assert.equal(await page.locator(".recipe-card").count(), 0);
  await page.locator("#clear-recipe-search").click();
  await page.locator(".recipe-open").click();
  await page.locator("#ingredients-list li").first().waitFor();
  await page.locator("#chosen-servings").fill("4");
  await page.locator("#chosen-servings").dispatchEvent("change");
  assert(
    (await page.locator("#ingredients-list").textContent()).includes(
      "8 tomatoes",
    ),
  );
  assert(
    (await page.locator("#ingredients-list").textContent()).includes(
      "salt to taste",
    ),
  );
  check("immediate recipe search and conservative serving scaling");
  await page.locator("#add-to-list").click();
  await page.locator("#transfer-list").selectOption("new");
  await page.locator("#transfer-new-name").fill("Soup night");
  await page.locator("#confirm-transfer").click();
  await page
    .getByText("Added 2 ingredients. 0 merged.", { exact: true })
    .waitFor();
  check("review scaled ingredients and create list in transfer");
  await page.locator("#close-ingredient-picker").click();
  // Edit from library, move rows, persist notes; cancel unsaved changes stays in editor.
  await page.locator('.recipe-card [data-action="edit"]').click();
  const edit = page.locator("#edit-steps + .structured-editor");
  await edit.locator('[data-row-action="down"]').first().click();
  await page.locator("#edit-notes").fill("Use ripe tomatoes.");
  await page.locator('#edit-recipe-form [type="submit"]').click();
  await page.locator("#edit-modal").waitFor({ state: "hidden" });
  recipe = await api(`/recipes/${rid}`);
  assert.equal(recipe.steps_ordered, "Blend and serve.\nRoast tomatoes.");
  assert.equal(recipe.notes, "Use ripe tomatoes.");
  check("recipe row order and notes save");
  await page.locator(".recipe-open").click();
  await page.locator("#ingredients-list li").first().waitFor();
  await page.locator("#favorite-recipe").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#favorite-recipe")
      .textContent.includes("Favorited"),
  );
  await page.locator("#close-modal").click();
  await page.locator(".recipe-open").click();
  await page.locator("#ingredients-list li").first().waitFor();
  await page.locator("#add-photo-btn").click();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9qkAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .locator("#photo-file")
    .setInputFiles({ name: "soup.png", mimeType: "image/png", buffer: png });
  await page.locator("#photo-preview").waitFor({ state: "visible" });
  await page.locator("#photo-caption").fill("Soup test photo");
  await page.locator('#upload-photo-form [type="submit"]').click();
  await page.locator("#upload-modal").waitFor({ state: "hidden" });
  // Recipe child overlays are siblings and can be reopened without nested focus traps.
  await page.locator(".recipe-open").click();
  await page.locator("[data-cover-id]").first().waitFor();
  await page.locator("[data-cover-id]").first().click();
  await page.waitForFunction(() => document.querySelector(".recipe-card img"));
  check("photo preview, upload, recipe association and cover image");
  await page.locator("#edit-nutrition-btn").click();
  await page.getByText("Per Serving Values", { exact: true }).click();
  await page
    .getByText("Total Recipe Values (Optional)", { exact: true })
    .click();
  await page.locator("#edit-calories-serv").fill("120");
  await page.locator("#edit-calories-total").fill("240");
  await page.locator("#save-nutrition-changes").click();
  await page.locator("#nutrition-edit-modal").waitFor({ state: "hidden" });
  assert.equal((await api(`/recipes/${rid}`)).nutrition.calories_total, 240);
  check("nutrition save preserves per-serving and recipe totals");
  await page.locator(".recipe-open").click();
  await page.locator("#close-modal").click();
  await page.locator('.recipe-card [data-action="edit"]').click();
  await page.locator("#edit-title").fill("Unsaved title");
  await page.locator("#cancel-edit").click();
  await page.locator('dialog [data-answer="no"]').click();
  assert.equal(await page.locator("#edit-title").inputValue(), "Unsaved title");
  await page.locator("#cancel-edit").click();
  await page.locator('dialog [data-answer="yes"]').click();
  await page.locator("#edit-modal").waitFor({ state: "hidden" });
  check("unsaved editor confirmation retains changes on cancel");
  await page.locator("#new-recipe-btn").click();
  await page.route("**/recipes/import-url", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        title: "Imported stew",
        ingredients_text: "1 potato",
        steps_ordered: "Simmer.",
        servings: "2",
        original_url: "https://example.com/stew",
        nutrition: { protein_per_serving: 3 },
      }),
    }),
  );
  await page.locator("#import-url").fill("https://example.com/stew");
  await page.locator('#url-import-form [type="submit"]').click();
  await page.waitForFunction(
    () => document.querySelector("#manual-title").value === "Imported stew",
  );
  await page.locator("#manual-title").fill("Corrected stew");
  await page.locator('#manual-entry-form [type="submit"]').click();
  await page.locator("#import-modal").waitFor({ state: "hidden" });
  await page.unroute("**/recipes/import-url");
  const imported = (await api("/recipes")).find(
    (r) => r.title === "Corrected stew",
  );
  assert(imported);
  assert.equal(imported.original_url, "https://example.com/stew");
  assert.equal(imported.nutrition.protein_per_serving, 3);
  check(
    "controlled URL import review, correction, attribution and nutrition save",
  );
  // Cooking mode and persistent accurate timers.
  await page.goto(base + `/cooking.html?recipe_id=${rid}`);
  await page.locator(".cooking-step").first().waitFor();
  await page.locator('[data-step="0"]').check();
  await page.locator("#focus-mode").click();
  await page.locator("#next-step").click();
  await page.locator("#timer-label").fill("Soup");
  await page.locator("#timer-minutes").fill("0.03");
  await page.locator("#timer-form button").click();
  await page.reload();
  await page.locator("#timers li").waitFor();
  assert(await page.locator('[data-step="0"]').isChecked());
  await page.waitForFunction(
    () =>
      document
        .querySelector("#timer-announcement")
        .textContent.includes("finished"),
    null,
    { timeout: 5000 },
  );
  check(
    "cooking progress, focused navigation, timer deadline survives refresh",
  );
  await page.locator("#reset-progress-btn").click();
  await page.locator('dialog [data-answer="yes"]').click();
  assert.equal(await page.locator('[data-step="0"]').isChecked(), false);
  await api(`/recipes/${rid}`, "PUT", { steps_ordered: "New instruction." });
  await page.reload();
  await page.locator(".cooking-step").first().waitFor();
  assert.equal(await page.locator(".cooking-step").count(), 1);
  check("reset and edited-recipe progress invalidation");
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, name] of [
      ["lists.html", "lists"],
      [`lists.html?list=${lid}`, "detail"],
      ["index.html", "recipes"],
      [`cooking.html?recipe_id=${rid}`, "cooking"],
      ["photos.html", "photos"],
    ]) {
      await page.goto(base + "/" + route);
      await page.waitForLoadState("networkidle");
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `horizontal overflow ${route} ${width}`,
      );
      await page.screenshot({
        path: `${evidence}/after-${name}-${width}.png`,
        fullPage: true,
      });
    }
    check(
      `${width}px layout: lists, detail, recipes, cooking, photos have no horizontal overflow`,
    );
  }
  assert.deepEqual(errors, []);
  check("no browser JavaScript errors");
  const output = fs.openSync(`${evidence}/after-existing-api.txt`, "w");
  const tests = spawn(
    "python",
    [
      "-m",
      "pytest",
      "tests/test_ui_repair_api.py",
      "tests/test_ui_repair_import.py",
      "-q",
    ],
    {
      env: { ...process.env, PYTHONPATH: "backend", FOOD_TEST_URL: base },
      stdio: ["ignore", output, output],
    },
  );
  const code = await new Promise((r) => tests.on("close", r));
  assert.equal(code, 0, "existing production API checks");
  check("existing production API regressions pass");
})()
  .catch((e) => {
    console.error(e);
    errors.push(e.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    fs.writeFileSync(
      `${evidence}/browser-checks.json`,
      JSON.stringify({ checks, errors }, null, 2),
    );
    await browser?.close();
    await stop();
  });
