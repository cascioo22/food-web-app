const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
(async () => {
  const server = spawn(
    "npm",
    ["run", "preview", "--prefix", "frontend", "--", "--host", "127.0.0.1"],
    { stdio: "ignore" },
  );
  for (let n = 0; n < 50; n++) {
    try {
      if ((await fetch("http://127.0.0.1:4173")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
      "--no-zygote",
      "--use-angle=swiftshader",
    ],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let recipes = [
      "breakfast, brunch, dessert",
      "Lunch",
      "Dinner",
      "Dessert",
      "Chili",
    ].map((category, i) => ({
      id: i + 1,
      title: [
        "Cinnamon rolls",
        "Garden sandwich",
        "Cheeseburger sliders",
        "Berry cake",
        "Chicken chili",
      ][i],
      category,
      ingredients_text: "1 cup flour",
      steps_ordered: "Mix.\nCook.",
      prep_time: "20 minutes",
      servings: "4",
    }));
    let saved;
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (req.method() === "PUT") {
        saved = req.postDataJSON();
        recipes = recipes.map((r) => (r.id === 5 ? { ...r, ...saved } : r));
        return route.fulfill({ json: recipes[4] });
      }
      return route.fulfill({
        json:
          path === "/api/recipes"
            ? recipes
            : path === "/api/grocery-lists"
              ? []
              : { photos: [] },
      });
    });
    for (const width of [393, 768, 1280]) {
      await page.setViewportSize({ width, height: 852 });
      await page.goto("http://127.0.0.1:4173/");
      await page.getByTestId("recipe-card").first().waitFor();
      const offsets = await page
        .getByTestId("recipe-card")
        .evaluateAll((cards) =>
          cards.map((c) => {
            const button = c.querySelector("button"),
              tile = button.firstElementChild;
            return (
              tile.getBoundingClientRect().left - c.getBoundingClientRect().left
            );
          }),
        );
      assert(
        offsets.every((x) => Math.abs(x - 17) < 1),
        JSON.stringify(offsets),
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `docs/evidence/meal-categories/recipes-${width}.png`,
        fullPage: true,
      });
    }
    await page.getByRole("combobox", { name: "Category", exact: true }).click();
    assert.deepEqual(await page.getByRole("option").allTextContents(), [
      "All categories",
      "Breakfast",
      "Lunch",
      "Dinner",
      "Dessert",
    ]);
    await page.getByRole("option", { name: "Breakfast", exact: true }).click();
    assert.equal(await page.getByTestId("recipe-card").count(), 1);
    await page.goto("http://127.0.0.1:4173/index.html?edit=5");
    await page
      .getByRole("textbox", { name: "Recipe title", exact: true })
      .waitFor();
    // Editing unrelated fields preserves a legacy category until a user changes it.
    await page
      .getByRole("textbox", { name: "Recipe title", exact: true })
      .fill("Updated chili");
    await page
      .getByRole("button", { name: "Save recipe", exact: true })
      .first()
      .click();
    await page.getByText("Recipe updated.", { exact: true }).waitFor();
    assert.equal(saved.category, "Chili");
    await page.goto("http://127.0.0.1:4173/index.html?edit=5");
    await page.getByRole("combobox", { name: "Category", exact: true }).click();
    assert.deepEqual(await page.getByRole("option").allTextContents(), [
      "Uncategorized",
      "Breakfast",
      "Lunch",
      "Dinner",
      "Dessert",
    ]);
    await page.getByRole("option", { name: "Dinner", exact: true }).click();
    await page
      .getByRole("button", { name: "Save recipe", exact: true })
      .first()
      .click();
    await page.getByText("Recipe updated.", { exact: true }).waitFor();
    assert.equal(saved.category, "Dinner");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: left alignment, no overflow at 393/768/1280; four meal filters; imported alias filtering; legacy category preservation; category selection and saving; no page errors. Mock API, actual production frontend.",
    );
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
