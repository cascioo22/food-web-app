/* Shared feedback and accessible confirmation. No external UI dependency. */
window.FoodUI = (() => {
  const esc = (s) =>
    String(s ?? "").replace(
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
  async function api(path, method = "GET", data) {
    let response;
    try {
      response = await fetch(path, {
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
    } catch {
      throw new Error(
        "Connection lost. Your input is still here. Check your connection and retry.",
      );
    }
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok)
      throw new Error(
        typeof result?.detail === "string"
          ? result.detail
          : result?.detail?.message ||
              result?.detail?.[0]?.msg ||
              `Request failed (${response.status}). Please retry.`,
      );
    return result;
  }
  function toast(message, action, label = "Undo") {
    let host = document.getElementById("app-status");
    if (!host) {
      host = document.createElement("div");
      host.id = "app-status";
      host.className = "app-status";
      host.setAttribute("role", "status");
      document.body.append(host);
    }
    const entry = document.createElement("div");
    entry.className = "toast";
    entry.append(document.createTextNode(message + " "));
    if (action) {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = async () => {
        b.disabled = true;
        try {
          await action();
          entry.remove();
        } catch (e) {
          b.disabled = false;
          toast(e.message);
        }
      };
      entry.append(b);
    }
    const dismiss = document.createElement("button");
    dismiss.textContent = "×";
    dismiss.setAttribute("aria-label", "Dismiss message");
    dismiss.onclick = () => entry.remove();
    entry.append(dismiss);
    host.append(entry);
    if (!action) setTimeout(() => entry.remove(), 8000);
  }
  function confirm(message, verb = "Delete") {
    return new Promise((resolve) => {
      const previous = document.activeElement,
        dialog = document.createElement("dialog");
      dialog.className = "app-dialog";
      dialog.innerHTML = `<h2 id="confirmation-title">${esc(verb)}?</h2><p>${esc(message)}</p><div class="action-row"><button data-answer="no">Cancel</button><button class="btn btn-primary" data-answer="yes">${esc(verb)}</button></div>`;
      dialog.setAttribute("aria-labelledby", "confirmation-title");
      document.body.append(dialog);
      let answered = false;
      const finish = (value) => {
        if (answered) return;
        answered = true;
        dialog.close();
        dialog.remove();
        previous?.focus();
        resolve(value);
      };
      dialog.onclick = (e) => {
        const b = e.target.closest("[data-answer]");
        if (b) finish(b.dataset.answer === "yes");
      };
      dialog.oncancel = (e) => {
        e.preventDefault();
        finish(false);
      };
      dialog.showModal();
      dialog.querySelector("button").focus();
    });
  }
  // Focus management for existing overlay markup. Keep inactive overlays out of the focus order.
  function manageDialogs() {
    const states = new Map();
    const observer = new MutationObserver(() => {
      const open = [
        ...document.querySelectorAll(
          ".modal:not(.hidden),.import-modal:not(.hidden)",
        ),
      ].filter((el) => getComputedStyle(el).display !== "none");
      const top = open.at(-1);
      for (const el of open) {
        if (!states.has(el)) {
          states.set(el, document.activeElement);
          el.setAttribute("role", "dialog");
          el.setAttribute("aria-modal", "true");
          if (
            !el.hasAttribute("aria-label") &&
            !el.hasAttribute("aria-labelledby")
          )
            el.setAttribute(
              "aria-label",
              el.querySelector("h2,h3")?.textContent || "Recipe details",
            );
        }
        el.inert = el !== top;
      }
      for (const [el, prior] of states)
        if (!open.includes(el)) {
          el.inert = false;
          states.delete(el);
          if (prior?.isConnected) prior.focus();
        }
      // Inert only siblings outside the ancestor chain of the active overlay.
      document.querySelectorAll("[data-ui-inert]").forEach((el) => {
        el.inert = false;
        el.removeAttribute("data-ui-inert");
      });
      if (top) {
        let node = top;
        while (
          node.parentElement &&
          node.parentElement !== document.documentElement
        ) {
          for (const sibling of node.parentElement.children)
            if (
              sibling !== node &&
              !sibling.matches("script,.app-status,dialog")
            ) {
              sibling.inert = true;
              sibling.setAttribute("data-ui-inert", "");
            }
          node = node.parentElement;
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const modal = [...states.keys()].filter((el) => !el.inert).at(-1);
      if (!modal) return;
      const nodes = [
        ...modal.querySelectorAll(
          'button,a[href],input,textarea,select,[tabindex="0"]',
        ),
      ].filter(
        (n) =>
          !n.disabled && !n.closest(".hidden") && n.getClientRects().length,
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (!first) return;
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !modal.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !modal.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    manageDialogs();
    document.querySelectorAll("form").forEach((f) => (f.noValidate = true));
  });
  return { esc, api, toast, confirm };
})();
