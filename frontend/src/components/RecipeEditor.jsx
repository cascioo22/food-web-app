import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import { api, lines } from "../lib/api";
import { ActionButton, ErrorText, useUI } from "./UI";
import { useData } from "../App";
import { mealCategories, mealCategory } from "../lib/mealCategories";
const blank = {
  title: "",
  description: "",
  prep_time: "",
  cook_time: "",
  servings: "",
  category: "",
  original_url: "",
  notes: "",
};
const nutritionFields = [
  ["calories_per_serving", "Calories"],
  ["protein_per_serving", "Protein (g)"],
  ["carbohydrates_per_serving", "Carbs (g)"],
  ["fat_per_serving", "Fat (g)"],
  ["fiber_per_serving", "Fiber (g)"],
  ["sugar_per_serving", "Sugar (g)"],
  ["sodium_per_serving", "Sodium (mg)"],
];
const row = (text) => ({
  id: crypto.randomUUID(),
  name: text,
  quantity: "",
  unit: "",
  notes: "",
});
export default function RecipeEditor({ recipe }) {
  const { navigate, reload } = useData(),
    ui = useUI();
  const [draft, setDraft] = useState(() => ({
      ...blank,
      ...recipe,
    })),
    [ingredients, setIngredients] = useState(() =>
      lines(recipe?.ingredients_text).map(row),
    ),
    [steps, setSteps] = useState(() =>
      lines(recipe?.steps_ordered).map((text) => ({
        id: crypto.randomUUID(),
        text,
      })),
    ),
    [nutrition, setNutrition] = useState(recipe?.nutrition || {}),
    [mode, setMode] = useState(recipe ? "write" : "url"),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [importing, setImporting] = useState(false),
    [error, setError] = useState(""),
    [imported, setImported] = useState(false);
  const [nutritionDirty, setNutritionDirty] = useState(false);
  const saved = useRef(recipe?.id),
    submit = useRef(false);
  const dirty = () => ui.setDirty(true);
  useEffect(() => () => ui.setDirty(false), []);
  const change = (field, value) => {
    setDraft((d) => ({
      ...d,
      [field]: value,
    }));
    dirty();
  };
  async function importRecipe(e) {
    e.preventDefault();
    if (importing || !url.trim()) return;
    setImporting(true);
    setError("");
    try {
      const result = await api("/recipes/import-url", "POST", {
        url: url.trim(),
      });
      setDraft({
        ...blank,
        ...result,
        original_url: url.trim(),
      });
      setIngredients(lines(result.ingredients_text).map(row));
      setSteps(
        lines(result.steps_ordered).map((text) => ({
          id: crypto.randomUUID(),
          text,
        })),
      );
      setNutrition(result.nutrition || {});
      setNutritionDirty(true);
      setImported(true);
      setMode("write");
      dirty();
    } catch (e) {
      setError(`${e.message} You can enter the recipe below.`);
      setDraft((d) => ({
        ...d,
        original_url: url.trim(),
      }));
      setMode("write");
    } finally {
      setImporting(false);
    }
  }
  function move(set, index, offset) {
    set((rows) => {
      const result = [...rows];
      [result[index], result[index + offset]] = [
        result[index + offset],
        result[index],
      ];
      return result;
    });
    dirty();
  }
  async function save(e) {
    e.preventDefault();
    if (submit.current) return;
    if (!draft.title.trim()) {
      setError("Enter a recipe title.");
      document.getElementById("recipe-title")?.focus();
      return;
    }
    const invalid = Object.entries(nutrition).some(
      ([k, v]) =>
        k !== "serving_size" &&
        nutritionFields.some(([field]) => field === k) &&
        v !== "" &&
        v != null &&
        (!Number.isFinite(Number(v)) || Number(v) < 0),
    );
    if (invalid) {
      setError("Nutrition values must be zero or greater.");
      return;
    }
    submit.current = true;
    setBusy(true);
    setError("");
    try {
      const nutritionData = Object.fromEntries(
        nutritionFields.map(([key]) => [
          key,
          nutrition[key] !== "" && nutrition[key] != null
            ? Number(nutrition[key])
            : null,
        ]),
      );
      if (nutrition.serving_size)
        nutritionData.serving_size = nutrition.serving_size;
      const data = {
        ...Object.fromEntries(
          Object.keys(blank).map((k) => [k, String(draft[k] || "")]),
        ),
        title: draft.title.trim(),
        ingredients_text: ingredients
          .map(
            (r) =>
              [r.quantity, r.unit, r.name].filter(Boolean).join(" ") +
              (r.notes ? `, ${r.notes}` : ""),
          )
          .filter((s) => s.trim())
          .join("\n"),
        steps_ordered: steps
          .map((s) => s.text)
          .filter((s) => s.trim())
          .join("\n"),
      };
      if (saved.current) {
        await api(`/recipes/${saved.current}`, "PUT", data);
        if (nutritionDirty)
          await api(
            `/recipes/${saved.current}/nutrition`,
            "PUT",
            nutritionData,
          );
      } else {
        const result = await api("/recipes/manual-entry/save", "POST", {
          ...data,
          ...(Object.values(nutritionData).some((value) => value != null)
            ? {
                nutrition: nutritionData,
              }
            : {}),
        });
        saved.current = result.id;
      }
      await reload("recipes");
      ui.setDirty(false);
      ui.notify(recipe ? "Recipe updated." : "Recipe saved.");
      navigate(`/index.html?recipe=${saved.current}`, {
        force: true,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      submit.current = false;
    }
  }
  const rowActions = (index, length, set, removeLabel) => (
    <Stack direction="row" spacing={0.25}>
      <Tooltip title="Move up">
        <span>
          <IconButton
            size="small"
            aria-label={`Move ${removeLabel} ${index + 1} up`}
            disabled={index === 0 || busy}
            onClick={() => move(set, index, -1)}
          >
            <ArrowUpwardRounded
              sx={{
                fontSize: 17,
              }}
            />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Move down">
        <span>
          <IconButton
            size="small"
            aria-label={`Move ${removeLabel} ${index + 1} down`}
            disabled={index === length - 1 || busy}
            onClick={() => move(set, index, 1)}
          >
            <ArrowDownwardRounded
              sx={{
                fontSize: 17,
              }}
            />
          </IconButton>
        </span>
      </Tooltip>
      <IconButton
        size="small"
        aria-label={`Remove ${removeLabel} ${index + 1}`}
        disabled={busy}
        onClick={() => {
          set((v) => v.filter((_, i) => i !== index));
          dirty();
        }}
      >
        <CloseRounded
          sx={{
            fontSize: 18,
          }}
        />
      </IconButton>
    </Stack>
  );
  return (
    <Box
      sx={{
        maxWidth: 860,
        mx: "auto",
      }}
    >
      <Button
        startIcon={<ArrowBackRounded />}
        color="inherit"
        onClick={() =>
          navigate(recipe ? `/index.html?recipe=${recipe.id}` : "/index.html")
        }
        sx={{
          ml: -1.5,
          mb: 2,
        }}
      >
        Recipes
      </Button>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Typography variant="h1">
          {recipe ? "Edit recipe" : "Add recipe"}
        </Typography>
        {mode === "write" && (
          <ActionButton variant="contained" busy={busy} onClick={save}>
            Save recipe
          </ActionButton>
        )}
      </Stack>
      {!recipe && (
        <Tabs
          value={mode}
          onChange={(_, value) => setMode(value)}
          sx={{
            mb: 3,
            minHeight: 44,
          }}
        >
          <Tab
            value="url"
            label="From a link"
            sx={{
              minHeight: 44,
            }}
          />
          <Tab
            value="write"
            label="Write a recipe"
            sx={{
              minHeight: 44,
            }}
          />
        </Tabs>
      )}
      <ErrorText error={error} />
      {mode === "url" ? (
        <Paper
          variant="outlined"
          sx={{
            p: {
              xs: 2.5,
              sm: 4,
            },
            borderRadius: 3,
            maxWidth: 650,
          }}
        >
          <Typography
            variant="h2"
            sx={{
              mb: 2,
            }}
          >
            Import a recipe
          </Typography>
          <Box component="form" onSubmit={importRecipe} noValidate>
            <TextField
              label="Recipe link"
              placeholder="https://…"
              fullWidth
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <LinkRounded
                      color="action"
                      sx={{
                        mr: 1,
                      }}
                    />
                  ),
                },
                htmlInput: {
                  inputMode: "url",
                },
              }}
            />
            <ActionButton
              busy={importing}
              type="submit"
              variant="contained"
              sx={{
                mt: 2,
              }}
            >
              Import recipe
            </ActionButton>
          </Box>
        </Paper>
      ) : (
        <Box component="form" onSubmit={save} noValidate>
          {imported && (
            <Alert
              severity="info"
              sx={{
                mb: 2,
              }}
            >
              Review the imported details before saving.
            </Alert>
          )}
          <Paper
            variant="outlined"
            sx={{
              p: {
                xs: 2,
                sm: 3,
              },
              borderRadius: 3,
            }}
          >
            <Stack spacing={2.5}>
              <TextField
                id="recipe-title"
                label="Recipe title"
                required
                fullWidth
                value={draft.title}
                onChange={(e) => change("title", e.target.value)}
                error={!!error && !draft.title.trim()}
              />
              <TextField
                label="Description"
                multiline
                minRows={2}
                fullWidth
                value={draft.description}
                onChange={(e) => change("description", e.target.value)}
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                }}
              >
                {[
                  ["prep_time", "Prep time"],
                  ["cook_time", "Cook time"],
                  ["servings", "Servings"],
                ].map(([key, label]) => (
                  <TextField
                    key={key}
                    label={label}
                    value={draft[key]}
                    onChange={(e) => change(key, e.target.value)}
                  />
                ))}
                <FormControl fullWidth>
                  <InputLabel id="edit-meal-category-label">
                    Category
                  </InputLabel>
                  <Select
                    labelId="edit-meal-category-label"
                    label="Category"
                    value={mealCategory(draft.category)}
                    onChange={(e) => change("category", e.target.value)}
                  >
                    <MenuItem value="">Uncategorized</MenuItem>
                    {mealCategories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Stack>
          </Paper>
          <Paper
            variant="outlined"
            sx={{
              p: {
                xs: 2,
                sm: 3,
              },
              borderRadius: 3,
              mt: 2.5,
            }}
          >
            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h2">Ingredients</Typography>
              <Button
                startIcon={<AddRounded />}
                onClick={() => {
                  setIngredients((v) => [...v, row("")]);
                  dirty();
                }}
              >
                Add
              </Button>
            </Stack>
            <Stack spacing={1.5}>
              {ingredients.map((r, index) => (
                <Box
                  key={r.id}
                  data-testid="ingredient-editor"
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: "#FFFCFD",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "start",
                    }}
                  >
                    <TextField
                      label={`Ingredient ${index + 1}`}
                      fullWidth
                      multiline
                      value={r.name}
                      onChange={(e) => {
                        setIngredients((v) =>
                          v.map((i) =>
                            i.id === r.id
                              ? {
                                  ...i,
                                  name: e.target.value,
                                }
                              : i,
                          ),
                        );
                        dirty();
                      }}
                    />
                    {rowActions(
                      index,
                      ingredients.length,
                      setIngredients,
                      "ingredient",
                    )}
                  </Stack>
                  <Accordion
                    sx={{
                      mt: 1,
                      border: 0,
                      bgcolor: "transparent",
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreRounded />}
                      sx={{
                        minHeight: 32,
                        px: 0,
                        "& .MuiAccordionSummary-content": {
                          my: 0.25,
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                        }}
                      >
                        Quantity & preparation notes
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails
                      sx={{
                        px: 0,
                        pb: 0,
                      }}
                    >
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 1,
                        }}
                      >
                        {[
                          ["quantity", "Quantity"],
                          ["unit", "Unit"],
                          ["notes", "Preparation notes"],
                        ].map(([key, label]) => (
                          <TextField
                            key={key}
                            label={label}
                            value={r[key]}
                            sx={
                              key === "notes"
                                ? {
                                    gridColumn: "1 / -1",
                                  }
                                : {}
                            }
                            onChange={(e) => {
                              setIngredients((v) =>
                                v.map((i) =>
                                  i.id === r.id
                                    ? {
                                        ...i,
                                        [key]: e.target.value,
                                      }
                                    : i,
                                ),
                              );
                              dirty();
                            }}
                          />
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              ))}
            </Stack>
            <Accordion
              sx={{
                mt: 2,
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                <Typography variant="body2">
                  Paste multiple ingredients
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  label="One ingredient per line"
                  multiline
                  minRows={3}
                  fullWidth
                  id="paste-ingredients"
                />
                <Button
                  onClick={() => {
                    const field = document.getElementById("paste-ingredients");
                    setIngredients((v) => [
                      ...v,
                      ...lines(field.value).map(row),
                    ]);
                    field.value = "";
                    dirty();
                  }}
                  sx={{
                    mt: 1,
                  }}
                >
                  Add pasted ingredients
                </Button>
              </AccordionDetails>
            </Accordion>
          </Paper>
          <Paper
            variant="outlined"
            sx={{
              p: {
                xs: 2,
                sm: 3,
              },
              borderRadius: 3,
              mt: 2.5,
            }}
          >
            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h2">Method</Typography>
              <Button
                startIcon={<AddRounded />}
                onClick={() => {
                  setSteps((v) => [
                    ...v,
                    {
                      id: crypto.randomUUID(),
                      text: "",
                    },
                  ]);
                  dirty();
                }}
              >
                Add step
              </Button>
            </Stack>
            <Stack spacing={2}>
              {steps.map((step, index) => (
                <Box key={step.id} data-testid="step-editor">
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "start",
                    }}
                  >
                    <Chip
                      label={index + 1}
                      size="small"
                      sx={{
                        mt: 1,
                        bgcolor: "#EFE9F8",
                      }}
                    />
                    <TextField
                      label={`Step ${index + 1}`}
                      fullWidth
                      multiline
                      minRows={2}
                      value={step.text}
                      onChange={(e) => {
                        setSteps((v) =>
                          v.map((s) =>
                            s.id === step.id
                              ? {
                                  ...s,
                                  text: e.target.value,
                                }
                              : s,
                          ),
                        );
                        dirty();
                      }}
                    />
                  </Stack>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      pl: 4,
                      mt: 0.5,
                    }}
                  >
                    <Button
                      size="small"
                      onClick={() => {
                        setSteps((v) => {
                          const n = [...v];
                          n.splice(index + 1, 0, {
                            id: crypto.randomUUID(),
                            text: "",
                          });
                          return n;
                        });
                        dirty();
                      }}
                    >
                      Insert after
                    </Button>
                    {rowActions(index, steps.length, setSteps, "step")}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Paper>
          <Accordion
            sx={{
              mt: 2.5,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
              <Typography variant="h3">Notes & source</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField
                  label="Personal notes"
                  multiline
                  minRows={2}
                  value={draft.notes}
                  onChange={(e) => change("notes", e.target.value)}
                />
                <TextField
                  label="Source link"
                  value={draft.original_url}
                  onChange={(e) => change("original_url", e.target.value)}
                />
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion
            sx={{
              mt: 1.5,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
              <Typography variant="h3">Nutrition · optional</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mb: 2,
                }}
              >
                Per serving. Leave unavailable values empty.
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                }}
              >
                <TextField
                  label="Serving size"
                  value={nutrition.serving_size || ""}
                  onChange={(e) => {
                    setNutritionDirty(true);
                    setNutrition((v) => ({
                      ...v,
                      serving_size: e.target.value,
                    }));
                    dirty();
                  }}
                  sx={{
                    gridColumn: "1 / -1",
                  }}
                />
                {nutritionFields.map(([key, label]) => (
                  <TextField
                    key={key}
                    label={label}
                    type="number"
                    value={nutrition[key] ?? ""}
                    onChange={(e) => {
                      setNutritionDirty(true);
                      setNutrition((v) => ({
                        ...v,
                        [key]: e.target.value,
                      }));
                      dirty();
                    }}
                    slotProps={{
                      htmlInput: {
                        min: 0,
                        step: "any",
                      },
                    }}
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              justifyContent: "end",
              py: 3,
            }}
          >
            <Button
              disabled={busy}
              onClick={() =>
                navigate(
                  recipe ? `/index.html?recipe=${recipe.id}` : "/index.html",
                )
              }
            >
              Cancel
            </Button>
            <ActionButton type="submit" busy={busy} variant="contained">
              Save recipe
            </ActionButton>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
