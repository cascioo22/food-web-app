let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("../.qa/node_modules/playwright"));
}
const { spawn } = require("node:child_process");
const fs = require("fs");
(async () => {
  const env = {
    ...process.env,
    PYTHONPATH: "tests",
    FOOD_SOURCE_ROOT:
      process.env.FOOD_BEFORE_ROOT ||
      require("node:path").resolve("../food-before"),
    DATABASE_URL: "sqlite:////tmp/food-baseline-capture.db",
    PHOTO_UPLOAD_DIR: "/tmp/food-before-photos",
  };
  const server = spawn(
    "python",
    ["-m", "uvicorn", "serve_ui:app", "--port", "8011"],
    { env, stdio: "ignore" },
  );
  let b;
  try {
    for (let n = 0; n < 50; n++) {
      try {
        const r = await fetch("http://127.0.0.1:8011/health");
        if (r.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    const api = async (path, data) => {
      const r = await fetch("http://127.0.0.1:8011" + path, {
        method: data ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: data ? JSON.stringify(data) : undefined,
      });
      return r.json();
    };
    const l = await api("/grocery-lists", { name: "This week’s groceries" });
    for (const name of ["Milk", "Eggs", "Tomatoes", "Sourdough bread"])
      await api(`/grocery-lists/${l.id}/items`, { name });
    await api("/recipes/manual-entry/save", {
      title: "Roasted tomato soup",
      ingredients_text: "4 tomatoes\n2 tbsp olive oil\nsalt to taste",
      steps_ordered: "Roast tomatoes.\nBlend and season.",
      servings: "2",
      prep_time: "15 min",
      category: "Dinner",
    });
    b = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
      args: JSON.parse(process.env.CHROMIUM_ARGS || '["--no-sandbox"]'),
      headless: true,
    });
    const context = await b.newContext({
      viewport: { width: 390, height: 900 },
    });
    const page = await context.newPage();
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("http://127.0.0.1:8011/lists.html");
      await page.locator(".list-card").first().waitFor();
      await page.screenshot({
        path: `docs/evidence/refinement/before-lists-${width}.png`,
        fullPage: true,
      });
      await page.locator(".list-open").first().click();
      await page.screenshot({
        path: `docs/evidence/refinement/before-detail-${width}.png`,
        fullPage: true,
      });
      await page.goto("http://127.0.0.1:8011/index.html");
      await page.locator(".recipe-card").first().waitFor();
      await page.screenshot({
        path: `docs/evidence/refinement/before-recipes-${width}.png`,
        fullPage: true,
      });
    }
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
        env: {
          ...process.env,
          PYTHONPATH: "backend",
          FOOD_TEST_URL: "http://127.0.0.1:8011",
        },
        stdio: [
          "ignore",
          fs.openSync("docs/evidence/refinement/baseline-focused.txt", "w"),
          "inherit",
        ],
      },
    );
    await new Promise((resolve) => tests.on("close", resolve));
    console.log(
      "Before screenshots and original production API checks captured.",
    );
  } finally {
    await b?.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
