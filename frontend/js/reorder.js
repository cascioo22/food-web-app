/* Pointer events cover mouse, pen and touch. Buttons provide the same order operation. */
window.enableReorder = (container, onMove, enabled = () => true) => {
  let drag = null;
  const clean = () => {
    if (!drag) return;
    container
      .querySelectorAll(".dragging,.drop-before,.drop-after")
      .forEach((el) =>
        el.classList.remove("dragging", "drop-before", "drop-after"),
      );
    drag = null;
  };
  container.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest("[data-drag]");
    if (!handle || !enabled() || e.button !== 0) return;
    const row = handle.closest("[data-id]");
    if (!row) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    row.classList.add("dragging");
    drag = {
      row,
      handle,
      pointerId: e.pointerId,
      target: null,
      after: false,
      start: e.clientY,
    };
  });
  container.addEventListener("pointermove", (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.target = null;
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-id]");
    container
      .querySelectorAll(".drop-before,.drop-after")
      .forEach((el) => el.classList.remove("drop-before", "drop-after"));
    if (target && container.contains(target) && target !== drag.row) {
      drag.target = target;
      drag.after =
        e.clientY >
        target.getBoundingClientRect().top + target.offsetHeight / 2;
      target.classList.add(drag.after ? "drop-after" : "drop-before");
    }
    // Controlled auto-scroll at viewport edges; touch on content retains normal scrolling.
    if (e.clientY < 90) window.scrollBy(0, -12);
    else if (e.clientY > innerHeight - 90) window.scrollBy(0, 12);
  });
  container.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    clean();
    if (d.target && Math.abs(e.clientY - d.start) > 5)
      onMove(Number(d.row.dataset.id), Number(d.target.dataset.id), d.after);
  });
  container.addEventListener("pointercancel", clean);
  container.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clean();
  });
};
