function scaleIngredient(text, factor) {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return text;
  // Conservative: do not rewrite ranges, weights in parentheses, or ambiguous prose.
  const match = String(text).match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?=\s)(\s+.+)$/,
  );
  if (!match) return text;
  const vulgar = {
    "¼": 0.25,
    "½": 0.5,
    "¾": 0.75,
    "⅓": 1 / 3,
    "⅔": 2 / 3,
    "⅛": 0.125,
    "⅜": 0.375,
    "⅝": 0.625,
    "⅞": 0.875,
  };
  const quantity =
    match[1] in vulgar
      ? vulgar[match[1]]
      : match[1]
          .split(/\s+/)
          .reduce(
            (sum, p) =>
              sum +
              (p.includes("/")
                ? Number(p.split("/")[0]) / Number(p.split("/")[1])
                : Number(p)),
            0,
          );
  return Number.isFinite(quantity)
    ? `${Number((quantity * factor).toFixed(3))}${match[2]}`
    : text;
}
function remaining(timer, now = Date.now()) {
  return Math.max(0, timer.paused ? timer.remaining : timer.deadline - now);
}

export { scaleIngredient, remaining };
