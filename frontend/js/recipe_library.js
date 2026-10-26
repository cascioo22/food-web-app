/* Recipe library: API-backed editing, import review, grocery selection and photos. */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const lines = (value) =>
    String(value || "")
      .replace(/\\n/g, "\n")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  let recipes = [],
    currentRecipeId = null,
    ingredients = [],
    importedNutrition = null,
    chosenServings = null,
    dirty = false,
    saving = false;
  const editors = {};
  const selected = new Set();

  async function api(path, method = "GET", data) {
    const response = await fetch(path, {
      method,
      ...(data instanceof FormData
        ? { body: data }
        : data === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }),
    });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok)
      throw new Error(
        typeof result?.detail === "string"
          ? result.detail
          : result?.detail?.message || `Request failed (${response.status})`,
      );
    return result;
  }
  function status(id, message = "", type = "error") {
    const element = $(id);
    element.textContent = message;
    element.className = `status-message status-${type}${message ? "" : " hidden"}`;
  }
  function show(id) {
    if (id !== "recipe-modal") $("recipe-modal").classList.add("hidden");
    $(id).classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  async function close(id) {
    if (
      dirty &&
      ["edit-modal", "import-modal"].includes(id) &&
      !(await FoodUI.confirm(
        "Discard the recipe changes you have not saved?",
        "Discard changes",
      ))
    )
      return;
    dirty = false;
    $(id).classList.add("hidden");
    document.body.style.overflow = document.querySelector(
      ".modal:not(.hidden),.import-modal:not(.hidden)",
    )
      ? "hidden"
      : "";
  }
  function fail(error) {
    FoodUI.toast(error.message);
  }
  async function loadRecipes() {
    $("library-error").classList.add("hidden");
    try {
      recipes = await api("/recipes");
      const category =
        $("recipe-category").value ||
        new URLSearchParams(location.search).get("category") ||
        "";
      $("recipe-category").innerHTML =
        '<option value="">All categories</option>' +
        [...new Set(recipes.map((r) => r.category).filter(Boolean))]
          .sort()
          .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
          .join("");
      $("recipe-category").value = category;
      renderRecipes();
    } catch (error) {
      $("recipe-grid").innerHTML = "";
      $("library-empty").classList.add("hidden");
      $("library-error").classList.remove("hidden");
    }
  }
  function renderRecipes() {
    const q = $("recipe-search").value.toLocaleLowerCase(),
      category = $("recipe-category").value,
      sort = $("recipe-sort").value;
    const filtered = recipes.filter(
      (r) =>
        [r.title, r.ingredients_text, r.category, r.description, r.notes]
          .join(" ")
          .toLocaleLowerCase()
          .includes(q) &&
        (!category || r.category === category),
    );
    const minutes = (r) => {
      const value = r.prep_time || "";
      const iso = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
      if (iso) return Number(iso[1] || 0) * 60 + Number(iso[2] || 0);
      const n = parseFloat(value);
      return Number.isFinite(n)
        ? n * (/hour|hr/i.test(value) ? 60 : 1)
        : Infinity;
    };
    filtered.sort((a, b) =>
      sort === "alpha"
        ? a.title.localeCompare(b.title)
        : sort === "time"
          ? minutes(a) - minutes(b)
          : sort === "favorites"
            ? Number(b.favorite) - Number(a.favorite) || b.id - a.id
            : sort === "cooked"
              ? String(b.last_cooked_at || "").localeCompare(
                  a.last_cooked_at || "",
                )
              : b.id - a.id,
    );
    $("recipe-grid").classList.toggle("hidden", !filtered.length);
    $("library-empty").classList.toggle("hidden", !!filtered.length);
    $("clear-recipe-search").classList.toggle("hidden", !q);
    $("library-empty").querySelector("h2").textContent = recipes.length
      ? "No matching recipes"
      : "Your collection starts here";
    $("library-empty").querySelector("p").textContent = recipes.length
      ? "Try another search or category."
      : "Import a recipe URL or create your first recipe.";
    $("library-count").textContent =
      `${filtered.length} recipe${filtered.length === 1 ? "" : "s"}${q ? " found" : ""}`;
    $("recipe-grid").innerHTML = filtered
      .map(
        (r) =>
          `<article class="recipe-card" data-id="${r.id}"><button class="recipe-open" data-action="open" aria-label="Open ${esc(r.title)}"><div class="recipe-image-wrapper">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="" loading="lazy" width="400" height="300">` : '<div class="recipe-placeholder" aria-hidden="true">♧</div>'}</div><div class="recipe-content"><h2 class="recipe-title">${r.favorite ? "★ " : ""}${esc(r.title)}</h2><div class="recipe-meta">${esc([r.category, r.prep_time, r.servings ? `${r.servings} servings` : ""].filter(Boolean).join(" · "))}</div></div></button><div class="recipe-actions"><button data-action="edit">Edit</button><button data-action="delete">Delete</button></div></article>`,
      )
      .join("");
    const params = new URLSearchParams();
    if (q) params.set("q", $("recipe-search").value);
    if (category) params.set("category", category);
    if (sort !== "recent") params.set("sort", sort);
    history.replaceState(
      {},
      "",
      location.pathname + (params.size ? "?" + params : ""),
    );
  }
  function refreshEditors(prefix) {
    for (const kind of ["ingredients", "steps"])
      editors[`${prefix}-${kind}`]?.load();
  }
  function updateScaledIngredients() {
    const recipe = recipes.find((r) => r.id === currentRecipeId),
      base = Number(recipe?.servings),
      target = Number($("chosen-servings").value);
    chosenServings = base > 0 && target > 0 ? target : null;
    const factor = chosenServings / base;
    $("ingredients-list").innerHTML = ingredients
      .map(
        (i) =>
          `<li><label><input type="checkbox" data-id="${i.id}" ${selected.has(i.id) ? "checked" : ""}> ${esc(FoodMath.scaleIngredient(i.name, factor))}</label></li>`,
      )
      .join("");
    $("scaling-note").textContent =
      base > 0
        ? "Simple quantities scale; ambiguous measurements keep their original wording. Original recipe stays unchanged."
        : "Original quantities shown. Add a numeric serving count in Edit to enable scaling.";
    $("chosen-servings").disabled = !(base > 0);
  }
  function openImport() {
    $("url-import-form").reset();
    $("manual-entry-form").reset();
    importedNutrition = null;
    dirty = false;
    refreshEditors("manual");
    status("import-status");
    $("manual-entry-form").classList.add("hidden");
    show("import-modal");
    $("import-url").focus();
  }
  async function openRecipe(id) {
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    currentRecipeId = id;
    selected.clear();
    $("recipe-description").textContent = recipe.description || "";
    $("recipe-notes").textContent = recipe.notes
      ? "Your notes: " + recipe.notes
      : "";
    $("favorite-recipe").setAttribute("aria-pressed", !!recipe.favorite);
    $("favorite-recipe").textContent = recipe.favorite
      ? "★ Favorited"
      : "☆ Favorite";
    $("chosen-servings").value = Number(recipe.servings) || "";
    $("modal-title").textContent = recipe.title;
    document.querySelector(
      ".detail-meta .meta-item:nth-child(1) time",
    ).textContent = recipe.prep_time || "—";
    document.querySelector(
      ".detail-meta .meta-item:nth-child(2) span:last-child",
    ).textContent = recipe.servings || "—";
    document.querySelector(
      ".detail-meta .meta-item:nth-child(3) span:last-child",
    ).textContent = recipe.category || "—";
    $("steps-list").innerHTML = lines(recipe.steps_ordered)
      .map((s) => `<li>${esc(s)}</li>`)
      .join("");
    $("step-progress").textContent =
      `${lines(recipe.steps_ordered).length} steps`;
    $("ingredients-list").innerHTML = "";
    $("source-attribution").classList.toggle("hidden", !recipe.original_url);
    $("source-url").textContent = recipe.original_url || "";
    $("source-url").href = /^https?:\/\//i.test(recipe.original_url || "")
      ? recipe.original_url
      : "#";
    $("source-url").rel = "noopener noreferrer";
    show("recipe-modal");
    try {
      ingredients = await api(`/recipes/${id}/ingredients`);
      if (id !== currentRecipeId) return;
      updateScaledIngredients();
      await Promise.all([loadPhotos(id), loadNutrition(id)]);
    } catch (error) {
      fail(error);
    }
  }
  function openEdit(id) {
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    $("edit-recipe-id").value = id;
    for (const [field, input] of Object.entries({
      title: "title",
      prep_time: "prep",
      servings: "servings",
      category: "category",
      ingredients_text: "ingredients",
      steps_ordered: "steps",
    })) {
      $(`edit-${input}`).value = recipe[field] || "";
    }
    for (const [field, input] of Object.entries({
      description: "description",
      cook_time: "cook",
      notes: "notes",
      original_url: "url",
    }))
      $(`edit-${input}`).value = recipe[field] || "";
    dirty = false;
    refreshEditors("edit");
    status("edit-status");
    show("edit-modal");
    $("edit-title").focus();
  }
  async function deleteRecipe(id) {
    if (
      !(await FoodUI.confirm(
        "Delete this recipe? Photos will stay in your gallery. This cannot be undone.",
      ))
    )
      return;
    try {
      await api(`/recipes/${id}`, "DELETE");
      close("recipe-modal");
      await loadRecipes();
    } catch (error) {
      fail(error);
    }
  }
  async function loadPhotos(id) {
    $("gallery-loading").style.display = "block";
    try {
      const photos = await api(`/recipes/${id}/photos`);
      if (id !== currentRecipeId) return;
      $("gallery-grid").innerHTML = photos
        .map(
          (p) =>
            `<div class="photo-grid-item"><a href="${esc(p.url)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(p.thumbnail_url || p.url)}" alt="${esc(p.caption || "Recipe photo")}"></a><button data-cover-id="${p.id}">Use as cover</button></div>`,
        )
        .join("");
      $("gallery-empty").classList.toggle("hidden", !!photos.length);
    } finally {
      $("gallery-loading").style.display = "none";
    }
  }
  async function loadNutrition(id) {
    // The recipe response already carries optional nutrition; opening is read-only.
    const recipe = await api(`/recipes/${id}`);
    if (id !== currentRecipeId) return;
    const nutrition = recipe.nutrition || {};
    $("nutrition-section").classList.remove("hidden");
    $("edit-nutrition-btn").classList.remove("hidden");
    const fields = [
      ["Calories", "calories_per_serving", ""],
      ["Protein", "protein_per_serving", "g"],
      ["Carbs", "carbohydrates_per_serving", "g"],
      ["Fat", "fat_per_serving", "g"],
      ["Fiber", "fiber_per_serving", "g"],
      ["Sugar", "sugar_per_serving", "g"],
      ["Sodium", "sodium_per_serving", "mg"],
    ];
    $("nutrition-content").innerHTML = fields.some(
      ([, key]) => nutrition[key] != null,
    )
      ? "<p><strong>Per serving</strong> · Values may be incomplete or imported.</p>" +
        (nutrition.serving_size
          ? `<p>Serving: ${esc(nutrition.serving_size)}</p>`
          : "") +
        fields
          .map(
            ([label, key, unit]) =>
              `<div class="nutrition-row"><span>${label}</span><span>${nutrition[key] == null ? "—" : esc(nutrition[key]) + " " + unit}</span></div>`,
          )
          .join("")
      : "<p>No nutrition information yet. You can add it below.</p>";
    if (
      fields.some(
        ([, key]) => nutrition[key.replace("_per_serving", "_total")] != null,
      )
    )
      $("nutrition-content").insertAdjacentHTML(
        "beforeend",
        "<h4>Total recipe</h4>" +
          fields
            .map(
              ([label, key, unit]) =>
                `<div class="nutrition-row"><span>${label}</span><span>${nutrition[key.replace("_per_serving", "_total")] == null ? "—" : esc(nutrition[key.replace("_per_serving", "_total")]) + " " + unit}</span></div>`,
            )
            .join(""),
      );
    const mapping = {
      "servings-size": "serving_size",
      "calories-serv": "calories_per_serving",
      "protein-serv": "protein_per_serving",
      "carbs-serv": "carbohydrates_per_serving",
      "fat-serv": "fat_per_serving",
      "fiber-serv": "fiber_per_serving",
      "sugar-serv": "sugar_per_serving",
      "sodium-serv": "sodium_per_serving",
      "calories-total": "calories_total",
    };
    Object.assign(mapping, {
      "protein-total": "protein_total",
      "carbs-total": "carbohydrates_total",
      "fat-total": "fat_total",
      "fiber-total": "fiber_total",
      "sugar-total": "sugar_total",
      "sodium-total": "sodium_total",
    });
    // A late background response must not overwrite an editor the user is typing in.
    if (!$("nutrition-edit-modal").classList.contains("hidden")) return;
    for (const [input, key] of Object.entries(mapping))
      $(`edit-${input}`).value = nutrition[key] ?? "";
    $("edit-nutrition-recipe-id").value = id;
  }
  async function chooseList() {
    try {
      const lists = await api("/grocery-lists"),
        recipe = recipes.find((r) => r.id === currentRecipeId),
        factor = chosenServings / Number(recipe.servings);
      const chosen = ingredients.filter(
        (i) => !selected.size || selected.has(i.id),
      );
      $("ingredient-picker-content").innerHTML =
        `<h3>Review ingredients</h3><p>Duplicates are kept unless you choose numeric merge. Ambiguous quantities stay separate.</p><div class="transfer-review">${chosen.map((i) => `<div class="transfer-entry"><label><input type="checkbox" data-transfer-id="${i.id}" checked> Include ingredient</label><input type="text" data-transfer-name="${i.id}" aria-label="Ingredient wording" value="${esc(FoodMath.scaleIngredient(i.name, factor))}"><details><summary>Quantity and unit (optional)</summary><label>Quantity<input data-transfer-quantity="${i.id}" type="text" placeholder="e.g. 2"></label><label>Unit<input data-transfer-unit="${i.id}" type="text" placeholder="e.g. lb"></label></details></div>`).join("")}</div><label>Grocery list<select id="transfer-list">${lists.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("")}<option value="new">Create new list…</option></select></label><label>New list name<input id="transfer-new-name" placeholder="Weekly groceries"></label><label>Duplicates<select id="duplicate-policy"><option value="keep">Keep separate (preserve wording)</option><option value="merge">Merge compatible numeric quantities</option></select></label><p class="hint">${chosen.filter((i) => lists.some((l) => l.items.some((x) => x.name.toLowerCase() === i.name.toLowerCase()))).length} ingredient(s) already appear on an existing list.</p><button id="confirm-transfer" class="btn btn-primary">Add ingredients</button><p id="transfer-status" role="status"></p>`;
      show("ingredient-picker");
      const operation = crypto.randomUUID();
      let createdId = null;
      $("confirm-transfer").onclick = async () => {
        const button = $("confirm-transfer");
        button.disabled = true;
        try {
          let listId = $("transfer-list").value;
          const items = [
            ...$("ingredient-picker-content").querySelectorAll(
              "[data-transfer-id]:checked",
            ),
          ].map((c) => ({
            name: $("ingredient-picker-content")
              .querySelector(`[data-transfer-name="${c.dataset.transferId}"]`)
              .value.trim(),
            quantity: $("ingredient-picker-content").querySelector(
              `[data-transfer-quantity="${c.dataset.transferId}"]`,
            ).value,
            unit: $("ingredient-picker-content").querySelector(
              `[data-transfer-unit="${c.dataset.transferId}"]`,
            ).value,
          }));
          if (!items.length || items.some((i) => !i.name))
            throw new Error("Select ingredients with a nonempty name.");
          if (listId === "new") {
            const name = $("transfer-new-name").value.trim();
            if (!name) throw new Error("Enter a name for the new list.");
            if (!createdId)
              createdId = (await api("/grocery-lists", "POST", { name })).id;
            listId = createdId;
          }
          const result = await api(
            `/grocery-lists/${listId}/items/bulk`,
            "POST",
            {
              items,
              operation_id: operation,
              duplicate_policy: $("duplicate-policy").value,
            },
          );
          $("ingredient-picker-content").innerHTML =
            `<p role="status">Added ${result.added_count} ingredients. ${result.merged_count} merged.</p><a href="lists.html?list=${listId}">Open grocery list</a>`;
        } catch (e) {
          $("transfer-status").textContent = e.message;
          button.disabled = false;
        }
      };
    } catch (error) {
      fail(error);
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    const totals = $("edit-calories-total").closest(
      ".form-group",
    ).parentElement;
    totals.insertAdjacentHTML(
      "beforeend",
      '<div class="form-group"><label for="edit-protein-total">Total protein (g)</label><input id="edit-protein-total" type="number" min="0" step="any"></div><div class="form-group"><label for="edit-carbs-total">Total carbohydrates (g)</label><input id="edit-carbs-total" type="number" min="0" step="any"></div><div class="form-group"><label for="edit-fat-total">Total fat (g)</label><input id="edit-fat-total" type="number" min="0" step="any"></div><div class="form-group"><label for="edit-fiber-total">Total fiber (g)</label><input id="edit-fiber-total" type="number" min="0" step="any"></div><div class="form-group"><label for="edit-sugar-total">Total sugar (g)</label><input id="edit-sugar-total" type="number" min="0" step="any"></div><div class="form-group"><label for="edit-sodium-total">Total sodium (mg)</label><input id="edit-sodium-total" type="number" min="0" step="any"></div>',
    );
    for (const id of [
      "upload-modal",
      "nutrition-edit-modal",
      "ingredient-picker",
    ])
      document.body.append($(id));
    for (const prefix of ["manual", "edit"])
      for (const kind of ["ingredients", "steps"])
        editors[`${prefix}-${kind}`] = new RecipeEditor(
          $(`${prefix}-${kind}`),
          kind,
        );
    const params = new URLSearchParams(location.search);
    $("recipe-search").value = params.get("q") || "";
    $("recipe-sort").value = params.get("sort") || "recent";
    $("recipe-search").oninput = (e) => {
      if (!e.isComposing) renderRecipes();
    };
    $("recipe-search").oncompositionend = renderRecipes;
    $("clear-recipe-search").onclick = () => {
      $("recipe-search").value = "";
      renderRecipes();
      $("recipe-search").focus();
    };
    $("recipe-category").onchange = $("recipe-sort").onchange = renderRecipes;
    $("chosen-servings").onchange = updateScaledIngredients;
    $("gallery-grid").onclick = async (e) => {
      const b = e.target.closest("[data-cover-id]");
      if (b)
        try {
          await api(`/recipes/${currentRecipeId}`, "PUT", {
            cover_photo_id: Number(b.dataset.coverId),
          });
          await loadRecipes();
          FoodUI.toast("Recipe cover updated.");
        } catch (err) {
          fail(err);
        }
    };
    $("favorite-recipe").onclick = async () => {
      try {
        const recipe = recipes.find((r) => r.id === currentRecipeId);
        await api(`/recipes/${currentRecipeId}`, "PUT", {
          favorite: !recipe.favorite,
        });
        await loadRecipes();
        await openRecipe(currentRecipeId);
      } catch (err) {
        fail(err);
      }
    };
    for (const id of ["manual-entry-form", "edit-recipe-form"])
      $(id).addEventListener("input", () => (dirty = true));
    window.addEventListener("beforeunload", (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    $("photo-file").onchange = () => {
      const file = $("photo-file").files[0];
      let img = $("photo-preview");
      if (!img) {
        img = document.createElement("img");
        img.id = "photo-preview";
        img.className = "cover-preview";
        $("photo-file").after(img);
      }
      if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
      img.dataset.url = file ? URL.createObjectURL(file) : "";
      img.src = img.dataset.url;
      img.alt = "Selected photo preview";
    };

    for (const id of [
      "import-modal",
      "recipe-modal",
      "edit-modal",
      "upload-modal",
      "nutrition-edit-modal",
      "ingredient-picker",
    ]) {
      $(id).addEventListener("click", (e) => {
        if (e.target === $(id) || e.target.classList.contains("modal-backdrop"))
          close(id);
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        const open = [
          "ingredient-picker",
          "nutrition-edit-modal",
          "upload-modal",
          "edit-modal",
          "import-modal",
          "recipe-modal",
        ].find((id) => !$(id).classList.contains("hidden"));
        if (open) close(open);
      }
    });
    $("add-recipe-btn").onclick = openImport;
    $("new-recipe-btn").onclick = openImport;
    $("close-import").onclick = () => close("import-modal");
    $("manual-entry-btn").onclick = () => {
      importedNutrition = null;
      $("manual-entry-form").classList.remove("hidden");
      $("manual-title").focus();
    };
    $("close-modal").onclick = () => close("recipe-modal");
    $("cancel-edit").onclick = () => close("edit-modal");
    $("cancel-upload").onclick = () => close("upload-modal");
    $("cancel-edit-nutrition").onclick = () => close("nutrition-edit-modal");
    $("close-ingredient-picker").onclick = () => close("ingredient-picker");
    $("retry-recipes-btn").onclick = loadRecipes;
    $("recipe-grid").addEventListener("click", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card) return;
      const id = Number(card.dataset.id),
        action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "edit") openEdit(id);
      else if (action === "delete") deleteRecipe(id);
      else openRecipe(id);
    });
    $("recipe-grid").addEventListener("keydown", (e) => {
      if (
        (e.key === "Enter" || e.key === " ") &&
        e.target.matches(".recipe-card")
      ) {
        e.preventDefault();
        openRecipe(Number(e.target.dataset.id));
      }
    });
    $("ingredients-list").onchange = (e) => {
      const id = Number(e.target.dataset.id);
      if (e.target.checked) selected.add(id);
      else selected.delete(id);
    };
    $("edit-recipe-btn").onclick = $("edit-recipe-btn-footer").onclick = () =>
      openEdit(currentRecipeId);
    $("delete-recipe-btn").onclick = () => deleteRecipe(currentRecipeId);
    $("start-cooking-btn").onclick = async () => {
      try {
        await api(`/recipes/${currentRecipeId}`, "PUT", {
          last_cooked_at: new Date().toISOString(),
        });
      } catch (e) {
        fail(e);
      }
      location.href = `cooking.html?recipe_id=${currentRecipeId}`;
    };
    $("add-to-list").onclick = chooseList;
    $("select-ingredients-btn").onclick = chooseList;
    $("url-import-form").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button");
      button.disabled = true;
      status("import-status", "Importing…", "warning");
      try {
        const result = await api("/recipes/import-url", "POST", {
          url: $("import-url").value.trim(),
        });
        importedNutrition = result.nutrition;
        $("manual-description").value = result.description || "";
        $("manual-cook").value = result.cook_time || "";
        $("manual-url").value = $("import-url").value;
        for (const [field, input] of Object.entries({
          title: "title",
          prep_time: "prep",
          servings: "servings",
          category: "category",
          ingredients_text: "ingredients",
          steps_ordered: "steps",
        }))
          $(`manual-${input}`).value = result[field] || "";
        refreshEditors("manual");
        dirty = true;
        $("manual-entry-form").classList.remove("hidden");
        status(
          "import-status",
          "Review the imported recipe, including servings and missing fields, then save. " +
            (recipes.some(
              (r) => r.original_url === $("import-url").value.trim(),
            )
              ? "This URL is already in your collection."
              : ""),
          "success",
        );
      } catch (error) {
        importedNutrition = null;
        status(
          "import-status",
          error.message + " You can enter the recipe manually.",
        );
        $("manual-entry-form").classList.remove("hidden");
      } finally {
        button.disabled = false;
      }
    };
    $("manual-entry-form").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(e.target));
        data.steps_ordered = data.steps_text;
        delete data.steps_text;
        if (!data.title.trim()) throw new Error("Enter a recipe title.");
        data.original_url =
          $("manual-url").value.trim() || $("import-url").value.trim();
        if (importedNutrition) data.nutrition = importedNutrition;
        const saved = await api("/recipes/manual-entry/save", "POST", data);
        dirty = false;
        close("import-modal");
        await loadRecipes();
      } catch (error) {
        status("import-status", error.message);
      } finally {
        button.disabled = false;
      }
    };
    $("edit-recipe-form").onsubmit = async (e) => {
      e.preventDefault();
      if (saving) return;
      saving = true;
      const button = e.target.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const id = Number($("edit-recipe-id").value),
          data = {};
        for (const [field, input] of Object.entries({
          title: "title",
          prep_time: "prep",
          servings: "servings",
          category: "category",
          ingredients_text: "ingredients",
          steps_ordered: "steps",
        }))
          data[field] = $(`edit-${input}`).value.trim();
        if (!data.title.trim()) throw new Error("Enter a recipe title.");
        for (const [field, input] of Object.entries({
          description: "description",
          cook_time: "cook",
          notes: "notes",
          original_url: "url",
        }))
          data[field] = $(`edit-${input}`).value;
        await api(`/recipes/${id}`, "PUT", data);
        dirty = false;
        close("edit-modal");
        await loadRecipes();
        if (!$("recipe-modal").classList.contains("hidden"))
          await openRecipe(id);
      } catch (error) {
        status("edit-status", error.message);
      } finally {
        saving = false;
        button.disabled = false;
      }
    };
    $("add-photo-btn").onclick = () => {
      $("upload-recipe-id").value = currentRecipeId;
      status("upload-status");
      show("upload-modal");
    };
    $("upload-photo-form").onsubmit = async (e) => {
      e.preventDefault();
      const file = $("photo-file").files[0];
      if (!file) {
        status("upload-status", "Select an image first.");
        return;
      }
      const button = e.target.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const data = new FormData();
        data.append("image", file);
        data.append("caption", $("photo-caption").value);
        data.append("recipe_id", currentRecipeId);
        await api("/photos", "POST", data);
        close("upload-modal");
        e.target.reset();
        await loadPhotos(currentRecipeId);
      } catch (error) {
        status("upload-status", error.message);
      } finally {
        button.disabled = false;
      }
    };
    $("edit-nutrition-btn").onclick = async () => {
      const id = currentRecipeId,
        button = $("edit-nutrition-btn");
      button.disabled = true;
      try {
        await loadNutrition(id);
        if (
          id === currentRecipeId &&
          !$("recipe-modal").classList.contains("hidden")
        ) {
          status("nutrition-edit-status");
          show("nutrition-edit-modal");
        }
      } catch (error) {
        fail(error);
      } finally {
        button.disabled = false;
      }
    };
    $("save-nutrition-changes").onclick = async () => {
      const data = {},
        mapping = {
          "servings-size": "serving_size",
          "calories-serv": "calories_per_serving",
          "protein-serv": "protein_per_serving",
          "carbs-serv": "carbohydrates_per_serving",
          "fat-serv": "fat_per_serving",
          "fiber-serv": "fiber_per_serving",
          "sugar-serv": "sugar_per_serving",
          "sodium-serv": "sodium_per_serving",
          "calories-total": "calories_total",
        };
      Object.assign(mapping, {
        "protein-total": "protein_total",
        "carbs-total": "carbohydrates_total",
        "fat-total": "fat_total",
        "fiber-total": "fiber_total",
        "sugar-total": "sugar_total",
        "sodium-total": "sodium_total",
      });
      for (const [input, key] of Object.entries(mapping)) {
        const value = $(`edit-${input}`).value.trim();
        data[key] =
          value === "" ? null : key === "serving_size" ? value : Number(value);
      }
      try {
        await api(`/recipes/${currentRecipeId}/nutrition`, "PUT", data);
        close("nutrition-edit-modal");
        await loadNutrition(currentRecipeId);
      } catch (error) {
        status("nutrition-edit-status", error.message);
      }
    };
    loadRecipes();
  });
})();
