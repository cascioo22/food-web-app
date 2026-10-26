let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("../.qa/node_modules/playwright"));
}
const { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const base = "http://127.0.0.1:8016",
  folder = "docs/evidence/react-redesign";
fs.mkdirSync(folder, { recursive: true });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pantry-react-"));
const log = fs.openSync(folder + "/server.log", "w");
let server, browser;
async function api(route, data) {
  const r = await fetch(base + "/api" + route, {
    method: data ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!r.ok) throw Error(await r.text());
  return r.json();
}
(async () => {
  try {
    server = spawn(
      "python",
      ["-m", "uvicorn", "serve_react:app", "--port", "8016"],
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
        if ((await fetch(base + "/api/health")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    const recipes = [
      [
        "Lemon ricotta pancakes",
        "Breakfast",
        "20 min",
        "4",
        "1 cup ricotta\n2 eggs\n1 lemon\n1 cup flour",
      ],
      [
        "Tuscan white bean soup",
        "Dinner",
        "25 min",
        "4",
        "2 cans white beans\n1 onion\n2 cups stock",
      ],
      [
        "Tomato & basil pasta",
        "Dinner",
        "20 min",
        "2",
        "200 g pasta\n2 cups cherry tomatoes\nbasil to taste",
      ],
      [
        "Roasted vegetable bowl",
        "Lunch",
        "35 min",
        "2",
        "1 sweet potato\n1 avocado\n2 cups spinach",
      ],
      [
        "Berry overnight oats",
        "Breakfast",
        "10 min",
        "2",
        "1 cup oats\n1 cup milk\n1 cup strawberries",
      ],
      [
        "Honey mustard chicken",
        "Dinner",
        "30 min",
        "4",
        "4 chicken breasts\n2 tbsp mustard\n1 tbsp honey",
      ],
    ];
    for (const [
      title,
      category,
      prep_time,
      servings,
      ingredients_text,
    ] of recipes)
      await api("/recipes/manual-entry/save", {
        title,
        category,
        prep_time,
        servings,
        ingredients_text,
        steps_ordered:
          "Prepare all the ingredients.\nCook gently until ready.\nTaste, adjust the seasoning, and serve.",
      });
    let weekly;
    for (const name of ["This week", "Baking day", "Weekend picnic"]) {
      const l = await api("/grocery-lists", { name });
      if (!weekly) weekly = l;
      for (const name of [
        "Strawberries",
        "Greek yogurt",
        "Sourdough bread",
        "Baby spinach",
        "2 medium ripe avocados",
        "Cherry tomatoes",
      ])
        await api(`/grocery-lists/${l.id}/items`, { name });
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
      args: JSON.parse(process.env.CHROMIUM_ARGS || '["--no-sandbox"]'),
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    for (const width of [393, 768, 1280]) {
      await page.setViewportSize({ width, height: 852 });
      for (const [route, name] of [
        ["index.html", "recipes"],
        ["lists.html", "lists"],
        [`lists.html?list=${weekly.id}`, "list-detail"],
        ["index.html?recipe=1", "recipe-detail"],
        ["cooking.html?recipe_id=1", "cooking"],
      ]) {
        await page.goto(base + "/" + route);
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: `${folder}/${name}-${width}.png`,
          fullPage: true,
        });
        console.log(name, width, await page.title());
      }
    }
    fs.writeFileSync(
      folder + "/preview-errors.json",
      JSON.stringify(errors, null, 2),
    );
    console.log("ERRORS", JSON.stringify(errors));
  } finally {
    await browser?.close();
    if (server) {
      server.kill();
      await new Promise((r) => server.on("close", r));
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
