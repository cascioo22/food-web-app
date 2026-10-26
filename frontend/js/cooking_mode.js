/* Device-local progress is fingerprinted; timers use deadlines, never interval counts. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id),
    { api, esc, toast, confirm } = FoodUI;
  const id = Number(new URLSearchParams(location.search).get("recipe_id"));
  let recipe,
    ingredients = [],
    steps = [],
    timers = [],
    progress = { ingredients: {}, steps: {}, current: 0, focused: false },
    fingerprint = "";
  const key = `fw_cooking_${id}`,
    timerKey = `fw_timers_${id}`;
  function storage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("This browser cannot save local progress. Keep this page open.");
    }
  }
  function save() {
    storage(key, { ...progress, fingerprint });
  }
  function render() {
    $("ingredients-container").innerHTML = ingredients
      .map(
        (text, i) =>
          `<li class="ingredient-item ${progress.ingredients[i] ? "completed" : ""}"><label><input type="checkbox" data-ingredient="${i}" ${progress.ingredients[i] ? "checked" : ""}><span>${esc(text)}</span></label></li>`,
      )
      .join("");
    $("steps-container").innerHTML = steps
      .map(
        (text, i) =>
          `<li class="cooking-step ${i === progress.current ? "current" : ""} ${progress.steps[i] ? "completed" : ""}" ${progress.focused && i !== progress.current ? "hidden" : ""}><span class="step-number-circle">${i + 1}</span><label><input type="checkbox" data-step="${i}" ${progress.steps[i] ? "checked" : ""}><span>${esc(text)}</span></label></li>`,
      )
      .join("");
    const complete = steps.filter((_, i) => progress.steps[i]).length;
    $("cook-progress").textContent =
      `${complete} of ${steps.length} steps complete`;
    $("progress-bar").value = steps.length
      ? (complete / steps.length) * 100
      : 0;
    $("step-label").textContent = steps.length
      ? `Current step: ${progress.current + 1} of ${steps.length}`
      : "No instructions yet. Add steps in the recipe editor.";
    $("previous-step").disabled = progress.current === 0;
    $("next-step").disabled = progress.current >= steps.length - 1;
    $("focus-mode").setAttribute("aria-pressed", progress.focused);
    $("focus-mode").textContent = progress.focused
      ? "Show all steps"
      : "Focus on one step";
  }
  function navigate(offset) {
    progress.current = Math.max(
      0,
      Math.min(steps.length - 1, progress.current + offset),
    );
    save();
    render();
  }
  $("ingredients-container").onchange = (e) => {
    if (e.target.dataset.ingredient === undefined) return;
    const index = e.target.dataset.ingredient;
    progress.ingredients[index] = e.target.checked;
    save();
    render();
    document.querySelector(`[data-ingredient="${index}"]`)?.focus();
  };
  $("steps-container").onchange = (e) => {
    if (e.target.dataset.step === undefined) return;
    const index = e.target.dataset.step;
    progress.steps[index] = e.target.checked;
    progress.current = Number(e.target.dataset.step);
    save();
    render();
    document.querySelector(`[data-step="${index}"]`)?.focus();
  };
  $("previous-step").onclick = () => navigate(-1);
  $("next-step").onclick = () => navigate(1);
  $("focus-mode").onclick = () => {
    progress.focused = !progress.focused;
    save();
    render();
  };
  $("reset-progress-btn").onclick = async () => {
    if (
      await confirm(
        "Clear ingredient and step checkmarks? Timers will continue.",
        "Reset progress",
      )
    ) {
      progress = {
        ingredients: {},
        steps: {},
        current: 0,
        focused: progress.focused,
      };
      save();
      render();
    }
  };
  document.addEventListener("keydown", (e) => {
    if (
      e.target.matches("input,textarea,select") ||
      document.querySelector("dialog[open]")
    )
      return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      navigate(1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      navigate(-1);
    }
  });
  const timeString = (ms) => {
    const seconds = Math.ceil(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  function renderTimers() {
    $("timers").innerHTML = timers
      .map(
        (t) =>
          `<li data-timer="${esc(t.id)}"><strong>${esc(t.label)}</strong><output>${timeString(FoodMath.remaining(t))}</output><span>${t.paused ? "Paused" : FoodMath.remaining(t) === 0 ? "Done" : "Running"}</span><button data-timer-action="pause">${t.paused ? "Resume" : "Pause"}</button><button data-timer-action="cancel">Cancel</button></li>`,
      )
      .join("");
  }
  function tick() {
    let changed = false;
    for (const t of timers) {
      if (!t.paused && FoodMath.remaining(t) === 0 && !t.announced) {
        t.announced = true;
        changed = true;
        $("timer-announcement").textContent = `${t.label} timer finished.`;
        toast(`${t.label} timer finished.`);
      }
    }
    if (changed) storage(timerKey, timers);
    for (const row of $("timers").children) {
      const t = timers.find((t) => t.id === row.dataset.timer);
      if (t) {
        row.querySelector("output").textContent = timeString(
          FoodMath.remaining(t),
        );
        row.querySelector("span").textContent = t.paused
          ? "Paused"
          : FoodMath.remaining(t) === 0
            ? "Done"
            : "Running";
      }
    }
  }
  $("timer-form").onsubmit = (e) => {
    e.preventDefault();
    const minutes = Number($("timer-minutes").value);
    if (!(minutes > 0 && minutes <= 1440)) {
      toast("Enter a duration between 0 and 1,440 minutes.");
      return;
    }
    timers.push({
      id: crypto.randomUUID(),
      label: $("timer-label").value.trim() || "Kitchen",
      deadline: Date.now() + minutes * 60000,
      remaining: minutes * 60000,
      paused: false,
      announced: false,
    });
    storage(timerKey, timers);
    renderTimers();
  };
  $("timers").onclick = (e) => {
    const button = e.target.closest("[data-timer-action]");
    if (!button) return;
    const id = button.closest("[data-timer]").dataset.timer,
      t = timers.find((t) => t.id === id);
    if (button.dataset.timerAction === "cancel")
      timers = timers.filter((t) => t.id !== id);
    else if (t.paused) {
      t.deadline = Date.now() + t.remaining;
      t.paused = false;
      t.announced = false;
    } else {
      t.remaining = FoodMath.remaining(t);
      t.paused = true;
    }
    storage(timerKey, timers);
    renderTimers();
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
  window.addEventListener("pageshow", tick);
  $("missing-ingredients").onclick = async () => {
    try {
      const lists = await api("/grocery-lists");
      const missing = ingredients.filter((_, i) => !progress.ingredients[i]);
      if (!missing.length) {
        toast("All ingredients are checked.");
        return;
      }
      $("missing-picker").classList.remove("hidden");
      $("missing-picker").innerHTML =
        `<label>Grocery list<select id="missing-list">${lists.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("")}<option value="new">Create new list</option></select></label><label>New list name<input id="missing-new" placeholder="Missing ingredients"></label><p>${missing.length} unchecked ingredients will be added. Existing duplicates are kept.</p><button id="missing-add">Add ingredients</button><p id="missing-status" role="status"></p>`;
      const op = crypto.randomUUID();
      let created = null;
      $("missing-add").onclick = async () => {
        const b = $("missing-add");
        b.disabled = true;
        try {
          let target = $("missing-list").value;
          if (target === "new") {
            if (!created)
              created = (
                await api("/grocery-lists", "POST", {
                  name: $("missing-new").value.trim() || "Missing ingredients",
                })
              ).id;
            target = created;
          }
          await api(`/grocery-lists/${target}/items/bulk`, "POST", {
            items: missing.map((name) => ({ name })),
            operation_id: op,
          });
          $("missing-picker").classList.add("hidden");
          toast("Missing ingredients added.");
        } catch (err) {
          $("missing-status").textContent = err.message;
          b.disabled = false;
        }
      };
    } catch (e) {
      toast(e.message);
    }
  };
  try {
    if (!id)
      throw new Error("Choose a recipe from the library to start cooking.");
    recipe = await api(`/recipes/${id}`);
    ingredients = String(recipe.ingredients_text || "")
      .split(/\r?\n/)
      .filter((s) => s.trim());
    steps = String(recipe.steps_ordered || "")
      .split(/\r?\n/)
      .filter((s) => s.trim());
    fingerprint = JSON.stringify([ingredients, steps]);
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      if (
        stored?.fingerprint === fingerprint &&
        stored.ingredients &&
        stored.steps
      )
        progress = {
          ...progress,
          ...stored,
          current: Math.min(
            steps.length - 1,
            Math.max(0, Number(stored.current) || 0),
          ),
        };
      else if (stored)
        toast("Recipe changed. Cooking checkmarks have been reset.");
      const saved = JSON.parse(localStorage.getItem(timerKey) || "[]");
      if (Array.isArray(saved))
        timers = saved.filter(
          (t) =>
            typeof t.id === "string" &&
            Number.isFinite(t.deadline) &&
            Number.isFinite(t.remaining),
        );
    } catch {}
    document.title = `Cooking ${recipe.title} · Food Webapp`;
    $("recipe-title-display").textContent = recipe.title;
    render();
    renderTimers();
    tick();
    setInterval(tick, 500);
  } catch (e) {
    $("cooking-error").textContent = e.message;
    $("cooking-error").classList.remove("hidden");
    $("recipe-title-display").textContent = "Unable to start cooking";
  }
});
