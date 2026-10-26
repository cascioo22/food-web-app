/* Exercises the shipped Vite build, not a mock UI or dev server. */
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("../.qa/node_modules/playwright"));
}
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process");
const base = "http://127.0.0.1:8017",
  folder = "docs/evidence/react-redesign",
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "pantry-check-"));
fs.mkdirSync(folder, { recursive: true });
let server, browser;
const checks = [],
  errors = [];
const check = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function start() {
  const log = fs.openSync(folder + "/checks-server.log", "a");
  server = spawn(
    "python",
    ["-m", "uvicorn", "serve_react:app", "--port", "8017"],
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
      if ((await fetch(base + "/api/health")).ok) return;
    } catch {}
    await delay(100);
  }
  throw Error("QA server did not start.");
}
async function stop() {
  if (server) {
    const current = server;
    server = null;
    current.kill();
    await new Promise((r) => current.on("close", r));
  }
}
async function api(route, method = "GET", data) {
  const r = await fetch(base + "/api" + route, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = r.status === 204 ? null : await r.json();
  assert(r.ok, JSON.stringify(body));
  return body;
}
async function waitFor(test, label) {
  for (let n = 0; n < 100; n++) {
    if (await test()) return;
    await delay(80);
  }
  throw Error("Timed out: " + label);
}
async function choose(page, label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function drag(page, handle, target, touch = false) {
  await waitFor(() => handle.isEnabled(), "drag handle enabled");
  await handle.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox(),
    to = await target.boundingBox();
  assert(from && to);
  const x = from.x + from.width / 2,
    y = from.y + from.height / 2,
    tx = to.x + to.width / 2,
    ty = to.y + to.height * 0.8;
  if (touch) {
    const s = await page.context().newCDPSession(page);
    await s.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 12; i++)
      await s.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x + ((tx - x) * i) / 12, y: y + ((ty - y) * i) / 12 },
        ],
      });
    await s.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await s.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(tx, ty, { steps: 18 });
    await page.mouse.up();
  }
}
(async () => {
  try {
    await start();
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
      args: JSON.parse(
        process.env.CHROMIUM_ARGS ||
          '["--no-sandbox","--disable-dev-shm-usage","--single-process","--no-zygote"]',
      ),
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/lists.html");
    await page
      .getByRole("heading", { name: "Grocery lists", exact: true })
      .waitFor();
    await page.getByText("Your first grocery list", { exact: true }).waitFor();
    check("empty list state and legacy .html deep link");
    await page.getByRole("button", { name: "New list", exact: true }).click();
    await page.getByLabel("List name", { exact: true }).fill("Weekly shop");
    await page
      .getByRole("button", { name: "Create list", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Weekly shop", exact: true })
      .waitFor();
    let lid = (await api("/grocery-lists"))[0].id;
    const quick = page.getByLabel("Add an item", { exact: true });
    await quick.fill("Milk");
    await quick.press("Enter");
    await waitFor(
      async () => (await api(`/grocery-lists/${lid}`)).items.length === 1,
      "first add",
    );
    assert(await quick.evaluate((e) => e === document.activeElement));
    await quick.fill("Eggs\nTomatoes\nBread");
    await page.getByRole("button", { name: "Add items", exact: true }).click();
    await waitFor(
      async () => (await api(`/grocery-lists/${lid}`)).items.length === 4,
      "bulk add",
    );
    check("consecutive entry, focus retention and multiline paste");
    await page
      .locator('[data-testid="grocery-row"] .item-name')
      .first()
      .click();
    await page.getByLabel("Item name", { exact: true }).fill("Oat milk");
    await page.getByLabel("Quantity", { exact: true }).fill("1");
    await page.getByLabel("Unit", { exact: true }).fill("gallon");
    await choose(page, "Category", "Dairy and eggs");
    await page.getByLabel("Notes", { exact: true }).fill("Unsweetened");
    await page.getByRole("button", { name: "Save item", exact: true }).click();
    await waitFor(
      async () =>
        (await api(`/grocery-lists/${lid}`)).items[0].name === "Oat milk",
      "inline edit",
    );
    check("inline item editing with optional quantity unit category notes");
    await page
      .getByRole("checkbox", { name: "Purchased Eggs", exact: true })
      .check();
    await waitFor(
      async () =>
        (await api(`/grocery-lists/${lid}`)).items.find(
          (i) => i.name === "Eggs",
        ).completed,
      "completion",
    );
    await drag(
      page,
      page.getByRole("button", { name: "Reorder Oat milk", exact: true }),
      page.locator('[data-testid="grocery-row"]').nth(2),
    );
    await waitFor(
      async () =>
        (await api(`/grocery-lists/${lid}`)).items[2].name === "Oat milk",
      "mouse item move",
    );
    assert(
      (await api(`/grocery-lists/${lid}`)).items.find((i) => i.name === "Eggs")
        .completed,
    );
    check("mouse item drag persists completion and order");
    await drag(
      page,
      page.getByRole("button", { name: "Reorder Eggs", exact: true }),
      page.locator('[data-testid="grocery-row"]').last(),
      true,
    );
    await waitFor(
      async () =>
        (await api(`/grocery-lists/${lid}`)).items.at(-1).name === "Eggs",
      "touch item move",
    );
    check("touch item drag via browser touch input");
    const keyboard = page.getByRole("button", {
      name: "Reorder Tomatoes",
      exact: true,
    });
    await waitFor(() => keyboard.isEnabled(), "keyboard handle enabled");
    await keyboard.focus();
    await keyboard.press("Space");
    await waitFor(
      async () => (await keyboard.getAttribute("aria-pressed")) === "true",
      "keyboard lift",
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await keyboard.press("ArrowDown");
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[role="status"]')].some((el) =>
        el.textContent.includes("Moving Tomatoes over Oat milk"),
      ),
    );
    await keyboard.press("Space");
    await waitFor(
      async () =>
        (await api(`/grocery-lists/${lid}`)).items[0].name === "Oat milk",
      "keyboard item move",
    );
    check("keyboard dnd lift move and drop");
    const order = (await api(`/grocery-lists/${lid}`)).items.map((i) => i.id);
    await page.reload();
    await quick.waitFor();
    assert.deepEqual(
      (await api(`/grocery-lists/${lid}`)).items.map((i) => i.id),
      order,
    );
    await page
      .getByRole("button", { name: "List options", exact: true })
      .click();
    await page.getByLabel("Hide purchased", { exact: true }).check();
    assert.equal(await page.getByTestId("grocery-row").count(), 3);
    await page.getByLabel("Hide purchased", { exact: true }).uncheck();
    await page.getByLabel("Purchased at bottom", { exact: true }).check();
    await page.getByLabel("Purchased at bottom", { exact: true }).uncheck();
    await choose(page, "Arrange view", "Category");
    assert.deepEqual(
      (await api(`/grocery-lists/${lid}`)).items.map((i) => i.id),
      order,
    );
    await choose(page, "Arrange view", "Manual order");
    await page.keyboard.press("Escape");
    check("filter grouping and purchased controls preserve manual order");
    await page
      .getByRole("button", { name: "Search items", exact: true })
      .click();
    await page.getByLabel("Find an item", { exact: true }).fill("Tomato");
    assert.equal(await page.getByTestId("grocery-row").count(), 1);
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Search items", exact: true })
      .click();
    await page.getByRole("button", { name: "Shopping", exact: true }).click();
    check("search and large-target shopping view");
    await page.getByRole("button", { name: "Share list", exact: true }).click();
    let text = await page
      .getByLabel("List preview", { exact: true })
      .inputValue();
    assert(text.includes("Oat milk — 1 gallon"));
    assert(!text.includes("[x]"));
    await page.getByLabel("Purchased items", { exact: true }).check();
    assert(
      (
        await page.getByLabel("List preview", { exact: true }).inputValue()
      ).includes("[x] Eggs"),
    );
    await page.getByRole("button", { name: "Copy text", exact: true }).click();
    await page
      .getByText("Copied. Ready to paste into your notes.", { exact: true })
      .waitFor();
    assert(
      (await page.evaluate(() => navigator.clipboard.readText())).includes(
        "Weekly shop",
      ),
    );
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByText(/Sharing is unavailable/).waitFor();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download text", exact: true })
      .click();
    assert((await download).suggestedFilename().endsWith(".txt"));
    await page
      .getByRole("button", { name: "Close export", exact: true })
      .click();
    check(
      "plain text export options actual clipboard native-share fallback download",
    );
    await page
      .getByRole("button", { name: "Actions for Bread", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Delete item", exact: true })
      .click();
    await waitFor(
      async () => (await api(`/grocery-lists/${lid}`)).items.length === 3,
      "delete",
    );
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitFor(
      async () => (await api(`/grocery-lists/${lid}`)).items.length === 4,
      "undo",
    );
    check("item delete and backend identity-preserving undo");
    await page.route("**/api/grocery-lists/*/items/bulk", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Temporary outage. Please retry." }),
      }),
    );
    await quick.fill("Butter");
    await quick.press("Enter");
    await page
      .getByText("Temporary outage. Please retry.", { exact: true })
      .waitFor();
    assert.equal(await quick.inputValue(), "Butter");
    await page.unroute("**/api/grocery-lists/*/items/bulk");
    await page.getByRole("button", { name: "Add items", exact: true }).click();
    await waitFor(
      async () => (await api(`/grocery-lists/${lid}`)).items.length === 5,
      "retry add",
    );
    check("failed add retains draft and retries once");
    await page
      .getByRole("button", { name: "Rename list", exact: true })
      .click();
    await page.getByLabel("List name", { exact: true }).fill("This week");
    await page
      .getByRole("button", { name: "Save list name", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "This week", exact: true })
      .waitFor();
    check("inline list rename");
    await page
      .getByRole("button", { name: "More actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Duplicate list", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "This week (copy)", exact: true })
      .waitFor();
    const copy = (await api("/grocery-lists")).find(
      (l) => l.name === "This week (copy)",
    );
    assert(!copy.items.some((i) => i.completed));
    check("list duplication resets completion");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Lists", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Grocery lists", exact: true })
      .waitFor();
    await drag(
      page,
      page.getByRole("button", { name: "Reorder This week", exact: true }),
      page.getByRole("button", {
        name: "Reorder This week (copy)",
        exact: true,
      }),
    );
    await waitFor(
      async () => (await api("/grocery-lists"))[0].id === copy.id,
      "list mouse move",
    );
    check("list mouse reorder");
    await drag(
      page,
      page.getByRole("button", {
        name: "Reorder This week (copy)",
        exact: true,
      }),
      page.getByRole("button", { name: "Reorder This week", exact: true }),
      true,
    );
    await waitFor(
      async () => (await api("/grocery-lists"))[0].id === lid,
      "list touch move",
    );
    check("list touch reorder");
    const listHandle = page.getByRole("button", {
      name: "Reorder This week",
      exact: true,
    });
    await waitFor(() => listHandle.isEnabled(), "list handle enabled");
    await listHandle.focus();
    await listHandle.press("Space");
    await waitFor(
      async () => (await listHandle.getAttribute("aria-pressed")) === "true",
      "list keyboard lift",
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await listHandle.press("ArrowDown");
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[role="status"]')].some((el) =>
        el.textContent.includes("Moving This week over This week (copy)"),
      ),
    );
    await listHandle.press("Space");
    await waitFor(
      async () => (await api("/grocery-lists"))[0].id === copy.id,
      "list keyboard move",
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
    check("list and item ordering survive a real server restart");
    await page.goto(base + `/lists.html?list=${lid}`);
    await page
      .getByRole("button", { name: "Actions for Butter", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Select to move or copy", exact: true })
      .click();
    await choose(page, "Move or copy to", "This week (copy)");
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await waitFor(
      async () => (await api(`/grocery-lists/${copy.id}`)).items.length === 6,
      "copy item",
    );
    check("selected-item copy to another list");
    await page.goto(base + "/index.html");
    await page.getByRole("button", { name: "Add recipe", exact: true }).click();
    await page
      .getByRole("tab", { name: "Write a recipe", exact: true })
      .click();
    await page.getByLabel("Recipe title", { exact: false }).fill("Lemon pasta");
    await page.getByLabel("Servings", { exact: true }).fill("2");
    await page.getByLabel("Prep time", { exact: true }).fill("15 min");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Ingredient 1", { exact: true }).fill("200 g pasta");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page
      .getByLabel("Ingredient 2", { exact: true })
      .fill("salt to taste");
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await page.getByLabel("Step 1", { exact: true }).fill("Cook the pasta.");
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await page.getByLabel("Step 2", { exact: true }).fill("Season and serve.");
    await page
      .getByRole("button", { name: "Save recipe", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Lemon pasta", exact: true })
      .waitFor();
    let r = (await api("/recipes")).find((r) => r.title === "Lemon pasta"),
      rid = r.id;
    assert.equal(r.ingredients_text, "200 g pasta\nsalt to taste");
    check("structured manual recipe creation and exact ingredient wording");
    await page.getByLabel("Servings", { exact: true }).fill("4");
    await page.getByText("400 g pasta", { exact: true }).waitFor();
    await page.getByText("salt to taste", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Add ingredients", exact: true })
      .click();
    await choose(page, "Grocery list", "+ New list");
    await page.getByLabel("List name", { exact: true }).fill("Pasta night");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add ingredients", exact: true })
      .click();
    await waitFor(
      async () =>
        (await api("/grocery-lists")).some(
          (l) => l.name === "Pasta night" && l.items[0]?.name === "400 g pasta",
        ),
      "scaled transfer",
    );
    check("serving adjustment and reviewed transfer with new-list creation");
    await page
      .getByRole("button", { name: "More actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Edit recipe", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Move step 1 down", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save recipe", exact: true })
      .first()
      .click();
    await waitFor(
      async () =>
        (await api(`/recipes/${rid}`)).steps_ordered ===
        "Season and serve.\nCook the pasta.",
      "step order",
    );
    check("ordered instruction editing");
    await page
      .getByRole("button", { name: "Favorite recipe", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remove favorite", exact: true })
      .waitFor();
    await page
      .getByRole("main")
      .getByRole("button", { name: "Recipes", exact: true })
      .click();
    await page.getByLabel("Search recipes", { exact: true }).fill("nonsense");
    await page.getByText("No matching recipes", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Clear recipe search", exact: true })
      .click();
    assert.equal(await page.getByTestId("recipe-card").count(), 1);
    check("favorites immediate search no-results and clear");
    await page
      .getByRole("button", { name: "Actions for Lemon pasta", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Edit recipe", exact: true })
      .click();
    await page
      .getByLabel("Recipe title", { exact: false })
      .fill("Unsaved title");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Recipes", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Recipe title", { exact: false }).inputValue(),
      "Unsaved title",
    );
    await page.goBack();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Recipe title", { exact: false }).inputValue(),
      "Unsaved title",
    );
    await page
      .getByRole("main")
      .getByRole("button", { name: "Recipes", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    check("unsaved editor protection covers app navigation and browser Back");
    await page
      .getByRole("main")
      .getByRole("button", { name: "Recipes", exact: true })
      .click();
    await page.getByRole("button", { name: "Add recipe", exact: true }).click();
    await page.route("**/api/recipes/import-url", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Imported soup",
          ingredients_text: "2 cups broth",
          steps_ordered: "Heat the broth.",
          servings: "2",
          nutrition: { calories_per_serving: 100 },
        }),
      }),
    );
    await page
      .getByLabel("Recipe link", { exact: true })
      .fill("https://example.com/soup");
    await page
      .getByRole("button", { name: "Import recipe", exact: true })
      .click();
    await page
      .getByLabel("Recipe title", { exact: false })
      .fill("Corrected soup");
    await page
      .getByRole("button", { name: "Save recipe", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Corrected soup", exact: true })
      .waitFor();
    await page.unroute("**/api/recipes/import-url");
    const imported = (await api("/recipes")).find(
      (r) => r.title === "Corrected soup",
    );
    assert.equal(imported.original_url, "https://example.com/soup");
    assert.equal(imported.nutrition.calories_per_serving, 100);
    check(
      "controlled import preview correction attribution and nutrition preservation",
    );
    await page.goto(base + `/index.html?recipe=${rid}`);
    await page
      .getByRole("button", { name: "More actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Add photo", exact: true })
      .click();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9qkAAAAASUVORK5CYII=",
      "base64",
    );
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "pasta.png", mimeType: "image/png", buffer: png });
    await page
      .getByAltText("Selected photo preview", { exact: true })
      .waitFor();
    await page.getByLabel("Caption", { exact: true }).fill("First pasta");
    await page
      .getByRole("button", { name: "Upload photo", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Use as cover", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Use as cover", exact: true })
      .click();
    await waitFor(
      async () => (await api("/recipes")).find((r) => r.id === rid).cover_url,
      "cover photo",
    );
    check("photo upload preview association and cover selection");
    await page.getByText("Nutrition", { exact: true }).click();
    await page
      .getByRole("button", { name: "Edit nutrition", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Calories (kcal)", { exact: true })
      .first()
      .fill("120");
    await page
      .getByRole("dialog")
      .getByLabel("Calories (kcal)", { exact: true })
      .nth(1)
      .fill("240");
    await page
      .getByRole("button", { name: "Save nutrition", exact: true })
      .click();
    await waitFor(
      async () =>
        (await api(`/recipes/${rid}`)).nutrition.calories_total === 240,
      "nutrition totals",
    );
    check("per-serving nutrition and recipe totals");
    await page.goto(base + "/photos.html");
    await page
      .getByRole("button", { name: "View First pasta", exact: true })
      .click();
    await page.getByLabel("Caption", { exact: true }).fill("Our first pasta");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "View Our first pasta", exact: true })
      .waitFor();
    check("photo gallery and caption editing");
    await page.goto(base + `/cooking.html?recipe_id=${rid}`);
    await page
      .getByRole("checkbox", { name: "Complete step 1", exact: true })
      .check();
    await page.getByRole("button", { name: "Focus mode", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    assert.equal(await page.getByTestId("cooking-step").count(), 1);
    await page.getByRole("button", { name: "Add timer", exact: true }).click();
    await page.getByLabel("Timer label", { exact: true }).fill("Pasta");
    await page.getByLabel("Minutes", { exact: true }).fill("0.04");
    await page
      .getByRole("button", { name: "Start timer", exact: true })
      .click();
    await page.reload();
    await page.getByTestId("timer-row").waitFor();
    await page
      .getByText("Pasta timer finished.", { exact: true })
      .waitFor({ timeout: 7000 });
    assert.equal(await page.getByTestId("cooking-step").count(), 1);
    check(
      "focused cooking navigation persisted progress and deadline timer across refresh",
    );
    await page.getByRole("button", { name: "Add timer", exact: true }).click();
    await page.getByLabel("Timer label", { exact: true }).fill("Bread");
    await page.getByLabel("Minutes", { exact: true }).fill("5");
    await page
      .getByRole("button", { name: "Start timer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Pause Bread", exact: true })
      .click();
    await page.getByText("Paused", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Resume Bread", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Cancel Bread", exact: true })
      .click();
    assert.equal(await page.getByTestId("timer-row").count(), 1);
    check("multiple timers pause resume cancel");
    await page
      .getByRole("button", { name: "Reset cooking progress", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Reset progress", exact: true })
      .click();
    await page
      .getByRole("checkbox", { name: "Complete step 1", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Complete step 1", exact: true })
        .isChecked(),
      false,
    );
    await api(`/recipes/${rid}`, "PUT", {
      steps_ordered: "A changed instruction.",
    });
    await page.reload();
    await page.getByText("A changed instruction.", { exact: true }).waitFor();
    check("progress reset and stale-content invalidation");
    for (const width of [393, 768, 1280]) {
      await page.setViewportSize({ width, height: 852 });
      for (const [route, name] of [
        ["index.html", "recipes"],
        ["lists.html", "lists"],
        [`lists.html?list=${lid}`, "list-detail"],
        [`index.html?recipe=${rid}`, "recipe-detail"],
        ["photos.html", "photos"],
        [`cooking.html?recipe_id=${rid}`, "cooking"],
      ]) {
        await page.goto(base + "/" + route);
        await page.waitForLoadState("networkidle");
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Overflow ${route} at ${width}`,
        );
        await page.screenshot({
          path: `${folder}/verified-${name}-${width}.png`,
          fullPage: true,
        });
      }
      check(
        `${width}px production layout no horizontal overflow across all screens`,
      );
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base + "/index.html");
    await page
      .getByRole("button", { name: "Actions for Lemon pasta", exact: true })
      .click();
    await page.getByRole("menu").waitFor();
    assert(
      await page
        .getByRole("menuitem", { name: "Edit recipe", exact: true })
        .isVisible(),
    );
    await page.keyboard.press("Escape");
    check("reduced-motion layout and real MUI menu keyboard dismissal");
    assert.deepEqual(errors, []);
    check("no browser JavaScript errors");
    const out = fs.openSync(folder + "/existing-api.txt", "w");
    const proc = spawn(
      "python",
      [
        "-m",
        "pytest",
        "tests/test_ui_repair_api.py",
        "tests/test_ui_repair_import.py",
        "-q",
      ],
      {
        env: {
          ...process.env,
          PYTHONPATH: "backend",
          FOOD_TEST_URL: base + "/api",
        },
        stdio: ["ignore", out, out],
      },
    );
    assert.equal(
      await new Promise((r) => proc.on("close", r)),
      0,
      "existing API regressions",
    );
    check("existing production API and import regressions");
  } finally {
    fs.writeFileSync(
      folder + "/browser-checks.json",
      JSON.stringify({ checks, errors }, null, 2),
    );
    await browser?.close();
    await stop();
  }
})().catch((e) => {
  console.error(e);
  errors.push(e.stack);
  fs.writeFileSync(
    folder + "/browser-checks.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  process.exitCode = 1;
});
