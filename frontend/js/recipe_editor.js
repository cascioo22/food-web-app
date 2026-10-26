/* Structured editor backed by the existing portable newline representation. */
window.RecipeEditor = class {
  constructor(textarea, kind) {
    this.source = textarea;
    this.kind = kind;
    this.host = document.createElement("div");
    this.host.className = "structured-editor";
    textarea.after(this.host);
    textarea.parentElement.querySelector("label").textContent =
      kind === "ingredients" ? "Ingredients" : "Numbered steps";
    textarea.classList.add("hidden");
    this.host.onclick = (e) => {
      const b = e.target.closest("[data-row-action]");
      if (!b) return;
      const rows = this.read(),
        index = Number(b.dataset.index),
        action = b.dataset.rowAction;
      if (action === "add") rows.push(this.empty());
      if (action === "insert") rows.splice(index + 1, 0, this.empty());
      if (action === "remove") rows.splice(index, 1);
      if (action === "up" && index > 0)
        [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
      if (action === "down" && index < rows.length - 1)
        [rows[index + 1], rows[index]] = [rows[index], rows[index + 1]];
      if (action === "paste") {
        const field = this.host.querySelector("[data-paste]");
        rows.push(
          ...field.value
            .split(/\r?\n/)
            .filter((s) => s.trim())
            .map((s) => this.parse(s)),
        );
      }
      this.render(rows);
      this.sync();
      this.source.dispatchEvent(new Event("input", { bubbles: true }));
    };
    this.host.oninput = () => {
      this.sync();
      this.source.dispatchEvent(new Event("input", { bubbles: true }));
    };
    this.host.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.matches("input")) e.preventDefault();
    };
    this.load();
  }
  empty() {
    return this.kind === "ingredients"
      ? { quantity: "", unit: "", name: "", notes: "" }
      : { text: "" };
  }
  parse(text) {
    return this.kind === "ingredients"
      ? { quantity: "", unit: "", name: text, notes: "" }
      : { text };
  }
  read() {
    return [...this.host.querySelectorAll(".editor-row")].map((row) =>
      Object.fromEntries(
        [...row.querySelectorAll("[data-field]")].map((f) => [
          f.dataset.field,
          f.value,
        ]),
      ),
    );
  }
  sync() {
    this.source.value = this.read()
      .map((r) =>
        this.kind === "ingredients"
          ? [r.quantity, r.unit, r.name].filter(Boolean).join(" ") +
            (r.notes ? `, ${r.notes}` : "")
          : r.text,
      )
      .filter((s) => s.trim())
      .join("\n");
  }
  load() {
    this.render(
      this.source.value
        .split(/\r?\n/)
        .filter((s) => s.trim())
        .map((s) => this.parse(s)),
    );
  }
  render(rows) {
    const { esc } = FoodUI;
    this.host.innerHTML = `<div class="editor-rows">${rows.map((r, i) => `<div class="editor-row">${this.kind === "ingredients" ? `<div class="two-columns"><label>Quantity<input data-field="quantity" value="${esc(r.quantity)}" aria-label="Ingredient ${i + 1} quantity"></label><label>Unit<input data-field="unit" value="${esc(r.unit)}" aria-label="Ingredient ${i + 1} unit"></label></div><label>Ingredient / original wording<input data-field="name" value="${esc(r.name)}" aria-label="Ingredient ${i + 1}"></label><label>Preparation notes<input data-field="notes" value="${esc(r.notes)}" aria-label="Ingredient ${i + 1} notes"></label>` : `<label>Step ${i + 1}<textarea data-field="text" aria-label="Step ${i + 1}">${esc(r.text)}</textarea></label>`}<div class="action-row"><button type="button" data-row-action="up" data-index="${i}" aria-label="Move row ${i + 1} up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" data-row-action="down" data-index="${i}" aria-label="Move row ${i + 1} down" ${i === rows.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-row-action="insert" data-index="${i}">Insert after</button><button type="button" data-row-action="remove" data-index="${i}">Remove</button></div></div>`).join("")}</div><button type="button" data-row-action="add">+ Add ${this.kind === "ingredients" ? "ingredient" : "step"}</button><details><summary>Paste multiple ${this.kind}</summary><label>One per line<textarea data-paste rows="3"></textarea></label><button type="button" data-row-action="paste">Add pasted rows</button></details>`;
  }
};
