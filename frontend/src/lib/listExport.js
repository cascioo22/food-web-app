function formatList(list, options = {}) {
  const {
    completed = false,
    quantities = true,
    categories = false,
    notes = false,
  } = options;
  const items = list.items.filter((i) => completed || !i.completed);
  let category = "";
  const rows = items.flatMap((i) => {
    const rows = [];
    if (categories && (i.category || "Other") !== category) {
      category = i.category || "Other";
      rows.push("", category);
    }
    let text = `[${completed && i.completed ? "x" : " "}] ${i.name}`;
    const amount = [i.quantity, i.unit].filter(Boolean).join(" ");
    if (quantities && amount) text += ` — ${amount}`;
    if (notes && i.notes) text += ` (${i.notes})`;
    rows.push(text);
    return rows;
  });
  return `${list.name}\n\n${rows.join("\n")}\n\n${items.length} ${items.length === 1 ? "item" : "items"} | ${items.filter((i) => i.completed).length} purchased`;
}

export { formatList };
