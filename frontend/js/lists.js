/* Lists use backend identity and canonical order; view controls never mutate it. */
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id),
    { api, esc, toast, confirm } = FoodUI;
  const categories = [
    "",
    "Produce",
    "Meat and seafood",
    "Dairy and eggs",
    "Pantry",
    "Frozen",
    "Bakery",
    "Household",
    "Other",
  ];
  let lists = [],
    currentId = null,
    busy = false,
    editing = null,
    pendingAdd = null;
  const selected = new Set(),
    drafts = new Map();
  const current = () => lists.find((l) => l.id === currentId);
  const error = (message, overview = false) => {
    const el = $(overview ? "overview-error" : "detail-error");
    el.textContent = message;
    el.classList.toggle("hidden", !message);
  };
  function prefs() {
    return {
      hide: $("hide-completed").checked,
      bottom: $("completed-bottom").checked,
      group: $("group-mode").value,
      shopping: $("shopping-toggle").getAttribute("aria-pressed") === "true",
    };
  }
  function savePrefs() {
    try {
      localStorage.setItem(
        `fw_list_view_${currentId}`,
        JSON.stringify(prefs()),
      );
    } catch {}
  }
  const canOrder = () =>
    !editing &&
    !$("item-search").value &&
    prefs().group === "manual" &&
    !prefs().hide &&
    !prefs().bottom;
  function arrows(index, length) {
    return `<button data-action="up" aria-label="Move up" ${index === 0 ? "disabled" : ""}>↑</button><button data-action="down" aria-label="Move down" ${index === length - 1 ? "disabled" : ""}>↓</button>`;
  }
  function renderOverview() {
    $("lists-container").innerHTML = lists.length
      ? lists
          .map((l, index) => {
            const done = l.items.filter((i) => i.completed).length;
            return `<article class="list-tile" data-id="${l.id}"><button class="drag-handle" data-drag aria-label="Drag ${esc(l.name)} to reorder">⠿</button><a href="?list=${l.id}" class="list-open"><h2>${esc(l.name)}</h2><p>${l.items.length - done} remaining <span>· ${done} purchased</span></p><progress value="${done}" max="${l.items.length || 1}" aria-label="${done} of ${l.items.length} purchased"></progress></a><div class="order-buttons">${arrows(index, lists.length)}</div></article>`;
          })
          .join("")
      : '<div class="empty-state"><h2>A fresh start</h2><p>Create a list above for your next grocery trip.</p></div>';
  }
  function render() {
    const existingForm = $("items-list").querySelector("[data-edit-form]");
    if (existingForm)
      drafts.set(
        Number(existingForm.closest("[data-id]").dataset.id),
        Object.fromEntries(new FormData(existingForm)),
      );
    renderOverview();
    const list = current();
    if (!list) return;
    $("remaining-count").textContent =
      `${list.items.filter((i) => !i.completed).length} remaining · ${list.items.filter((i) => i.completed).length} purchased`;
    const p = prefs(),
      query = $("item-search").value.toLocaleLowerCase();
    document.body.classList.toggle("shopping-mode", p.shopping);
    $("clear-search").classList.toggle("hidden", !query);
    $("order-hint").textContent = canOrder()
      ? "Drag handles or use arrows to arrange items."
      : "To reorder, use manual order, show purchased, clear search and turn off “Purchased at bottom”.";
    let items = list.items.filter(
      (i) =>
        (!p.hide || !i.completed) &&
        `${i.name} ${i.notes} ${i.category}`
          .toLocaleLowerCase()
          .includes(query),
    );
    if (p.group === "category")
      items = [...items].sort((a, b) =>
        (a.category || "Other").localeCompare(b.category || "Other"),
      );
    if (p.bottom)
      items = [
        ...items.filter((i) => !i.completed),
        ...items.filter((i) => i.completed),
      ];
    let lastCategory = "";
    $("items-list").innerHTML =
      items
        .map((i) => {
          let heading = "";
          if (
            p.group === "category" &&
            (i.category || "Other") !== lastCategory
          ) {
            lastCategory = i.category || "Other";
            heading = `<li class="category-heading">${esc(lastCategory)}</li>`;
          }
          const index = list.items.findIndex((x) => x.id === i.id);
          if (editing === i.id) {
            i = { ...i, ...drafts.get(i.id) };
            return (
              heading +
              `<li class="item-editor" data-id="${i.id}"><form novalidate data-edit-form><label>Item name<input name="name" value="${esc(i.name)}" maxlength="1000"></label><div class="two-columns"><label>Quantity<input name="quantity" value="${esc(i.quantity)}" maxlength="200" placeholder="e.g. 2 or a handful"></label><label>Unit<input name="unit" value="${esc(i.unit)}" maxlength="200" placeholder="e.g. lb"></label></div><label>Category<select name="category">${[...new Set([...categories, i.category])].map((c) => `<option ${c === i.category ? "selected" : ""} value="${esc(c)}">${esc(c || "No category")}</option>`).join("")}</select></label><label>Notes<textarea name="notes" maxlength="2000">${esc(i.notes)}</textarea></label><div class="action-row"><button class="btn btn-primary">Save</button><button type="button" data-action="cancel-edit">Cancel</button></div><p class="inline-error" role="alert"></p></form></li>`
            );
          }
          return (
            heading +
            `<li class="shopping-item ${i.completed ? "purchased" : ""}" data-id="${i.id}"><button class="drag-handle" data-drag aria-label="Drag ${esc(i.name)} to reorder" ${canOrder() ? "" : "disabled"}>⠿</button><label class="check-target"><input class="item-check" type="checkbox" ${i.completed ? "checked" : ""} aria-label="Purchased ${esc(i.name)}"></label><button class="item-main" data-action="edit"><span>${esc(i.name)}</span>${i.quantity || i.unit ? `<small>${esc([i.quantity, i.unit].filter(Boolean).join(" "))}</small>` : ""}${i.notes ? `<small>${esc(i.notes)}</small>` : ""}</button><details class="item-menu"><summary aria-label="Actions for ${esc(i.name)}">•••</summary><div><button data-action="edit">Edit item</button><button data-action="select">${selected.has(i.id) ? "Deselect" : "Select to move / copy"}</button><button data-action="delete" class="danger-text">Delete item</button>${canOrder() ? arrows(index, list.items.length) : ""}</div></details>${selected.has(i.id) ? '<span class="selected-mark" aria-label="Selected">✓</span>' : ""}</li>`
          );
        })
        .join("") ||
      `<li class="empty-state"><h2>${query ? "No matching items" : p.hide && list.items.length ? "All done!" : "What do you need?"}</h2><p>${query ? "Try another search." : "Add items above to start your list."}</p></li>`;
    $("selection-bar").classList.toggle("hidden", !selected.size);
    $("selection-count").textContent = `${selected.size} selected`;
    const destination = $("target-list").value;
    $("target-list").innerHTML =
      '<option value="">Choose another list</option>' +
      lists
        .filter((l) => l.id !== currentId)
        .map((l) => `<option value="${l.id}">${esc(l.name)}</option>`)
        .join("");
    if (lists.some((l) => String(l.id) === destination))
      $("target-list").value = destination;
  }
  async function load() {
    lists = await api("/grocery-lists");
    render();
  }
  async function run(action, overview = false) {
    if (busy) return;
    busy = true;
    error("", overview);
    document.body.classList.add("saving");
    try {
      await action();
    } catch (e) {
      error(e.message, overview);
    } finally {
      busy = false;
      document.body.classList.remove("saving");
    }
  }
  async function open(id, push = true) {
    if (
      editing &&
      !(await confirm(
        "Discard the item changes you have not saved?",
        "Discard changes",
      ))
    )
      return;
    currentId = id;
    editing = null;
    selected.clear();
    if (id && !current()) {
      error("This list is no longer available.", true);
      currentId = null;
    }
    $("overview").classList.toggle("hidden", !!currentId);
    $("list-detail").classList.toggle("hidden", !currentId);
    if (currentId) {
      $("list-name-input").value = current().name;
      $("detail-title").textContent = current().name;
      document.title = current().name + " · Grocery lists";
      let p = {};
      try {
        p = JSON.parse(localStorage.getItem(`fw_list_view_${id}`) || "{}");
      } catch {}
      $("hide-completed").checked = !!p.hide;
      $("completed-bottom").checked = !!p.bottom;
      $("group-mode").value = p.group || "manual";
      $("shopping-toggle").setAttribute("aria-pressed", !!p.shopping);
      $("quick-item").value =
        sessionStorage.getItem(`fw_list_draft_${id}`) || "";
    } else {
      document.body.classList.remove("shopping-mode");
      document.title = "Grocery lists · Food Webapp";
    }
    if (push)
      history.pushState(
        {},
        "",
        currentId ? `?list=${currentId}` : "lists.html",
      );
    render();
  }
  $("create-list-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $("new-list-name").value.trim();
    if (!name) {
      error("Give your new list a name.", true);
      $("new-list-name").focus();
      return;
    }
    run(async () => {
      const l = await api("/grocery-lists", "POST", { name });
      $("new-list-name").value = "";
      await load();
      await open(l.id);
      $("quick-item").focus();
    }, true);
  };
  $("lists-container").onclick = (e) => {
    const link = e.target.closest(".list-open");
    if (link) {
      e.preventDefault();
      open(Number(link.closest("[data-id]").dataset.id));
    }
    const b = e.target.closest("[data-action]");
    if (b) {
      const id = Number(b.closest("[data-id]").dataset.id),
        index = lists.findIndex((l) => l.id === id),
        target = lists[index + (b.dataset.action === "up" ? -1 : 1)];
      if (target) moveList(id, target.id, b.dataset.action === "down");
    }
  };
  $("back-to-lists").onclick = (e) => {
    e.preventDefault();
    open(null);
  };
  window.onpopstate = () =>
    open(
      Number(new URLSearchParams(location.search).get("list")) || null,
      false,
    );
  $("refresh-active-list").onclick = () =>
    run(async () => {
      await load();
      FoodUI.toast("List refreshed. Review any unsaved edits before saving.");
    });
  $("refresh-lists").onclick = () => run(load, true);
  $("rename-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $("list-name-input").value.trim();
    if (!name) {
      error("Enter a list name.");
      return;
    }
    run(async () => {
      const l = await api(`/grocery-lists/${currentId}`, "PATCH", { name });
      lists[lists.findIndex((x) => x.id === l.id)] = l;
      render();
      toast("List renamed.");
    });
  };
  $("quick-item").oninput = () => {
    sessionStorage.setItem(`fw_list_draft_${currentId}`, $("quick-item").value);
  };
  $("quick-item").onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $("quick-add-form").requestSubmit();
    }
  };
  $("quick-add-form").onsubmit = (e) => {
    e.preventDefault();
    const text = $("quick-item").value;
    const names = text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) {
      $("quick-item").focus();
      return;
    }
    if (names.length > 500 || names.some((n) => n.length > 1000)) {
      error("Use up to 500 items, each under 1,000 characters.");
      return;
    }
    const id = currentId;
    if (!pendingAdd || pendingAdd.text !== text || pendingAdd.listId !== id)
      pendingAdd = { text, listId: id, key: crypto.randomUUID() };
    run(async () => {
      const r = await api(`/grocery-lists/${id}/items/bulk`, "POST", {
        items: names.map((name) => ({ name })),
        operation_id: pendingAdd.key,
        duplicate_policy: "keep",
      });
      pendingAdd = null;
      lists[lists.findIndex((l) => l.id === id)] = r.list;
      if (currentId === id) {
        $("quick-item").value = "";
        sessionStorage.removeItem(`fw_list_draft_${id}`);
        render();
        $("quick-item").focus();
      }
      toast(`${r.added_count} item${r.added_count === 1 ? "" : "s"} added.`);
    });
  };
  $("items-list").onchange = (e) => {
    if (!e.target.matches(".item-check")) return;
    const item = current().items.find(
        (i) => i.id === Number(e.target.closest("[data-id]").dataset.id),
      ),
      value = e.target.checked,
      id = currentId;
    if (busy) {
      e.target.checked = item.completed;
      return;
    }
    e.target.disabled = true;
    run(async () => {
      try {
        const updated = await api(
          `/grocery-lists/${id}/items/${item.id}`,
          "PATCH",
          { completed: value, expected_version: item.version },
        );
        Object.assign(item, updated);
        current().revision += 1;
        render();
      } catch (err) {
        e.target.checked = item.completed;
        e.target.disabled = false;
        throw err;
      }
    });
  };
  $("items-list").onclick = async (e) => {
    const b = e.target.closest("[data-action]");
    if (!b || busy) return;
    const id = Number(b.closest("[data-id]").dataset.id),
      action = b.dataset.action,
      item = current().items.find((i) => i.id === id);
    if (action === "edit") {
      if (
        editing &&
        editing !== id &&
        !(await confirm(
          "Discard the item changes you have not saved?",
          "Discard changes",
        ))
      )
        return;
      editing = id;
      render();
      $("items-list").querySelector('[name="name"]')?.focus();
    }
    if (action === "cancel-edit") {
      drafts.delete(id);
      editing = null;
      $("items-list").querySelector("[data-edit-form]")?.remove();
      render();
    }
    if (action === "select") {
      selected.has(id) ? selected.delete(id) : selected.add(id);
      render();
    }
    if (action === "delete") {
      const listId = currentId;
      await run(async () => {
        await api(`/grocery-lists/${listId}/items/${id}`, "DELETE");
        selected.delete(id);
        await load();
        toast(`${item.name} removed.`, async () => {
          await api(`/grocery-lists/${listId}/restore`, "POST", { ids: [id] });
          await load();
        });
      });
    }
    if (action === "up" || action === "down") {
      const index = current().items.findIndex((i) => i.id === id),
        target = current().items[index + (action === "up" ? -1 : 1)];
      if (target) moveItem(id, target.id, action === "down");
    }
  };
  $("items-list").onsubmit = async (e) => {
    if (!e.target.matches("[data-edit-form]")) return;
    e.preventDefault();
    if (busy) return;
    const form = e.target,
      item = current().items.find((i) => i.id === editing),
      values = Object.fromEntries(new FormData(form));
    if (!values.name.trim()) {
      form.querySelector(".inline-error").textContent = "Enter an item name.";
      form.elements.name.focus();
      return;
    }
    await run(async () => {
      try {
        await api(`/grocery-lists/${currentId}/items/${item.id}`, "PATCH", {
          ...values,
          expected_version: item.version,
        });
        drafts.delete(item.id);
        editing = null;
        $("items-list").querySelector("[data-edit-form]")?.remove();
        await load();
        toast("Item saved.");
      } catch (err) {
        form.querySelector(".inline-error").textContent = err.message;
        throw err;
      }
    });
  };
  function reordered(records, id, target, after) {
    const ids = records.map((i) => i.id);
    ids.splice(ids.indexOf(id), 1);
    ids.splice(ids.indexOf(target) + (after ? 1 : 0), 0, id);
    return ids;
  }
  function moveList(id, target, after) {
    run(async () => {
      await api("/grocery-lists/order", "PUT", {
        ids: reordered(lists, id, target, after),
        expected_ids: lists.map((l) => l.id),
      });
      await load();
      toast("List order saved.");
    }, true);
  }
  function moveItem(id, target, after) {
    if (!canOrder()) return;
    run(async () => {
      await api(`/grocery-lists/${currentId}/items/order`, "PUT", {
        ids: reordered(current().items, id, target, after),
        expected_revision: current().revision,
      });
      await load();
      toast("Item order saved.");
    });
  }
  enableReorder($("lists-container"), moveList, () => !busy);
  enableReorder($("items-list"), moveItem, canOrder);
  for (const id of ["hide-completed", "completed-bottom", "group-mode"])
    $(id).onchange = () => {
      savePrefs();
      render();
    };
  $("shopping-toggle").onclick = () => {
    const b = $("shopping-toggle");
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
    savePrefs();
    render();
  };
  $("item-search").oninput = () => {
    if (!editing) render();
  };
  $("clear-search").onclick = () => {
    $("item-search").value = "";
    render();
    $("item-search").focus();
  };
  $("clear-selection").onclick = () => {
    selected.clear();
    render();
  };
  for (const [id, copy] of [
    ["move-selected", false],
    ["copy-selected", true],
  ])
    $(id).onclick = () =>
      run(async () => {
        const target = Number($("target-list").value);
        if (!target) throw new Error("Choose another list first.");
        await api(`/grocery-lists/${currentId}/transfer`, "POST", {
          ids: [...selected],
          target_list_id: target,
          copy,
          expected_revision: current().revision,
        });
        selected.clear();
        await load();
        toast(copy ? "Items copied." : "Items moved.");
      });
  $("duplicate-list").onclick = () =>
    run(async () => {
      const l = await api(`/grocery-lists/${currentId}/duplicate`, "POST", {});
      await load();
      await open(l.id);
      toast("List duplicated with all items unchecked.");
    });
  $("delete-list").onclick = async () => {
    if (
      await confirm(
        `Delete “${current().name}” and all its items? This cannot be undone.`,
      )
    )
      run(async () => {
        await api(`/grocery-lists/${currentId}`, "DELETE");
        await open(null);
        await load();
        toast("List deleted.");
      });
  };
  $("reset-list").onclick = async () => {
    if (
      await confirm(
        "Uncheck every purchased item and keep the same order?",
        "Uncheck all",
      )
    )
      run(async () => {
        await api(`/grocery-lists/${currentId}/reset`, "POST", {
          expected_revision: current().revision,
        });
        await load();
      });
  };
  $("clear-completed").onclick = () => {
    const id = currentId;
    run(async () => {
      const result = await api(`/grocery-lists/${id}/clear-completed`, "POST", {
        expected_revision: current().revision,
      });
      await load();
      toast(
        `${result.ids.length} purchased items removed.`,
        result.ids.length
          ? async () => {
              await api(`/grocery-lists/${id}/restore`, "POST", {
                ids: result.ids,
              });
              await load();
            }
          : null,
      );
    });
  };
  const preview = () => {
    $("export-preview").value = formatList(current(), {
      completed: $("export-completed").checked,
      quantities: $("export-quantities").checked,
      categories: $("export-categories").checked,
      notes: $("export-notes").checked,
    });
    $("export-print").textContent = $("export-preview").value;
  };
  $("export-list").onclick = () => {
    preview();
    $("export-status").textContent = "";
    $("export-dialog").showModal();
  };
  for (const id of ["completed", "quantities", "categories", "notes"])
    $("export-" + id).onchange = preview;
  $("close-export").onclick = () => $("export-dialog").close();
  $("copy-export").onclick = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText($("export-preview").value);
      $("export-status").textContent = "Copied. Paste into your notes app.";
    } catch {
      $("export-preview").focus();
      $("export-preview").select();
      $("export-status").textContent =
        "Automatic copy is unavailable. Copy the selected text, or download it below.";
    }
  };
  $("share-export").onclick = async () => {
    if (!navigator.share) {
      $("export-status").textContent =
        "Sharing is unavailable in this browser. Copy the text or download the file.";
      return;
    }
    try {
      await navigator.share({
        title: current().name,
        text: $("export-preview").value,
      });
      $("export-status").textContent = "Shared.";
    } catch (e) {
      $("export-status").textContent =
        e.name === "AbortError"
          ? "Sharing cancelled."
          : "Sharing failed. Copy or download the text instead.";
    }
  };
  $("download-export").onclick = () => {
    const url = URL.createObjectURL(
        new Blob([$("export-preview").value], {
          type: "text/plain;charset=utf-8",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download =
      (current().name.replace(/[^a-z0-9_-]/gi, "_") || "groceries") + ".txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("export-status").textContent = "Text file prepared.";
  };
  $("print-export").onclick = () => window.print();
  window.addEventListener("beforeunload", (e) => {
    if (editing) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  load()
    .then(() =>
      open(
        Number(new URLSearchParams(location.search).get("list")) || null,
        false,
      ),
    )
    .catch((e) => {
      error(e.message, true);
      $("lists-container").innerHTML =
        "<p>Could not load your lists. Use Refresh lists to retry.</p>";
    });
});
