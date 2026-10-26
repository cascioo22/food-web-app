import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import FavoriteBorderRounded from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import ChecklistRounded from "@mui/icons-material/ChecklistRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import { useData } from "../App";
import { api, lines } from "../lib/api";
import { scaleIngredient } from "../lib/foodMath";
import { ActionButton, ErrorText, Overflow, useUI } from "../components/UI";
import Transfer from "../components/Transfer";
import PhotoUpload from "../components/PhotoUpload";
import { mealCategory } from "../lib/mealCategories";
import { pastelColors } from "../components/FoodIllustration";
const nutritionFields = [
  ["calories", "Calories", "kcal"],
  ["protein", "Protein", "g"],
  ["carbohydrates", "Carbs", "g"],
  ["fat", "Fat", "g"],
  ["fiber", "Fiber", "g"],
  ["sugar", "Sugar", "g"],
  ["sodium", "Sodium", "mg"],
];
export default function RecipeDetail({ recipe, onDelete, onFavorite }) {
  const { navigate, photos, reload } = useData(),
    ui = useUI();
  const [servings, setServings] = useState(Number(recipe.servings) || ""),
    [selected, setSelected] = useState([]),
    [transfer, setTransfer] = useState(false),
    [upload, setUpload] = useState(false),
    [notes, setNotes] = useState(recipe.notes || ""),
    [editingNotes, setEditingNotes] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [nutritionEdit, setNutritionEdit] = useState(false),
    [nutrition, setNutrition] = useState(recipe.nutrition || {});
  const ingredients = lines(recipe.ingredients_text),
    steps = lines(recipe.steps_ordered),
    factor =
      Number(recipe.servings) > 0 && Number(servings) > 0
        ? Number(servings) / Number(recipe.servings)
        : 1;
  const linked = photos.filter((p) => p.recipe_id === recipe.id);
  const saveNotes = async () => {
    setBusy(true);
    try {
      await api(`/recipes/${recipe.id}`, "PUT", {
        notes,
      });
      await reload("recipes");
      setEditingNotes(false);
      ui.setDirty(false);
      ui.notify("Notes saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    ui.setDirty(editingNotes);
    return () => ui.setDirty(false);
  }, [editingNotes]);
  async function saveNutrition() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = {};
      for (const field of nutritionFields)
        for (const suffix of ["per_serving", "total"]) {
          const key = field[0] + "_" + suffix,
            value = nutrition[key];
          if (value === "" || value == null) data[key] = null;
          else if (!Number.isFinite(Number(value)) || Number(value) < 0)
            throw new Error("Use zero or greater for nutrition values.");
          else data[key] = Number(value);
        }
      data.serving_size = nutrition.serving_size || null;
      await api(`/recipes/${recipe.id}/nutrition`, "PUT", data);
      await reload("recipes");
      setNutritionEdit(false);
      ui.notify("Nutrition updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        startIcon={<ArrowBackRounded />}
        color="inherit"
        onClick={() => navigate("/index.html")}
        sx={{
          ml: -1.5,
          mb: 2,
        }}
      >
        Recipes
      </Button>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "start",
          mb: 2,
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
          }}
        >
          {mealCategory(recipe.category) && (
            <Chip
              size="small"
              label={mealCategory(recipe.category)}
              sx={{
                mb: 1.25,
                bgcolor: "#EFE9F8",
              }}
            />
          )}
          <Typography
            variant="h1"
            sx={{
              fontSize: {
                xs: "1.8rem",
                sm: "2.2rem",
              },
              maxWidth: 780,
            }}
          >
            {recipe.title}
          </Typography>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              mt: 1.25,
            }}
          >
            {recipe.prep_time && (
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                }}
              >
                Prep {recipe.prep_time}
              </Typography>
            )}
            {recipe.cook_time && (
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                }}
              >
                Cook {recipe.cook_time}
              </Typography>
            )}
          </Stack>
        </Box>
        <IconButton
          aria-label={recipe.favorite ? "Remove favorite" : "Favorite recipe"}
          onClick={onFavorite}
          color={recipe.favorite ? "primary" : "default"}
        >
          {recipe.favorite ? <FavoriteRounded /> : <FavoriteBorderRounded />}
        </IconButton>
        <Overflow
          items={[
            {
              label: "Edit recipe",
              icon: (
                <EditOutlined
                  sx={{
                    fontSize: "small",
                  }}
                />
              ),
              action: () => navigate(`/index.html?edit=${recipe.id}`),
            },
            {
              label: "Add photo",
              icon: (
                <AddPhotoAlternateOutlined
                  sx={{
                    fontSize: "small",
                  }}
                />
              ),
              action: () => setUpload(true),
            },
            {
              label: "Delete recipe",
              danger: true,
              icon: (
                <DeleteOutlineRounded
                  sx={{
                    fontSize: "small",
                  }}
                />
              ),
              action: onDelete,
            },
          ]}
        />
      </Stack>
      {recipe.description && (
        <Typography
          sx={{
            color: "text.secondary",
            maxWidth: 780,
            mb: 2.5,
          }}
        >
          {recipe.description}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          mb: 3,
        }}
      >
        <Button
          variant="contained"
          startIcon={<PlayArrowRounded />}
          onClick={async () => {
            try {
              await api(`/recipes/${recipe.id}`, "PUT", {
                last_cooked_at: new Date().toISOString(),
              });
              await reload("recipes");
            } catch {}
            navigate(`/cooking.html?recipe_id=${recipe.id}`);
          }}
        >
          Start cooking
        </Button>
        <Button
          variant="outlined"
          startIcon={<ChecklistRounded />}
          onClick={() => setTransfer(true)}
          disabled={!ingredients.length}
        >
          Add ingredients
        </Button>
      </Stack>
      <ErrorText error={error} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(0, .85fr) minmax(0, 1.3fr)",
          },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Stack spacing={2.5}>
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
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Typography variant="h2">Ingredients</Typography>
              {Number(recipe.servings) > 0 && (
                <TextField
                  type="number"
                  label="Servings"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  sx={{
                    width: 90,
                  }}
                  slotProps={{
                    htmlInput: {
                      min: 0.25,
                      max: 1000,
                      step: 0.25,
                    },
                  }}
                />
              )}
            </Stack>
            {ingredients.length ? (
              ingredients.map((text, index) => (
                <Stack
                  key={index}
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: "start",
                    borderBottom: index === ingredients.length - 1 ? 0 : 1,
                    borderColor: "divider",
                    py: 0.5,
                  }}
                >
                  <Checkbox
                    checked={selected.includes(index)}
                    onChange={() =>
                      setSelected((v) =>
                        v.includes(index)
                          ? v.filter((i) => i !== index)
                          : [...v, index],
                      )
                    }
                    slotProps={{
                      input: {
                        "aria-label": `Select ${text}`,
                      },
                    }}
                  />
                  <Typography
                    sx={{
                      py: 1.2,
                    }}
                  >
                    {scaleIngredient(text, factor)}
                  </Typography>
                </Stack>
              ))
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                }}
              >
                No ingredients added.
              </Typography>
            )}
            {factor !== 1 && (
              <Typography
                variant="caption"
                component="p"
                sx={{
                  color: "text.secondary",
                  mt: 2,
                }}
              >
                Scaled from {recipe.servings} servings. Unrecognized quantities
                remain unchanged.
              </Typography>
            )}
          </Paper>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
              <Typography variant="h3">Your notes</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {editingNotes ? (
                <Stack spacing={1.5}>
                  <TextField
                    label="Recipe notes"
                    fullWidth
                    multiline
                    minRows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <Stack direction="row">
                    <ActionButton busy={busy} onClick={saveNotes}>
                      Save notes
                    </ActionButton>
                    <Button
                      onClick={() => {
                        setNotes(recipe.notes || "");
                        setEditingNotes(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      whiteSpace: "pre-wrap",
                      mb: 1,
                    }}
                  >
                    {recipe.notes || "No notes yet."}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setEditingNotes(true)}
                    startIcon={
                      <EditOutlined
                        sx={{
                          fontSize: "small",
                        }}
                      />
                    }
                  >
                    Edit notes
                  </Button>
                </>
              )}
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreRounded />}>
              <Typography variant="h3">Nutrition</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {recipe.nutrition ? (
                <>
                  <Typography
                    variant="caption"
                    component="p"
                    sx={{
                      color: "text.secondary",
                      mb: 2,
                    }}
                  >
                    Imported or manually entered values may be incomplete.
                    {recipe.nutrition.serving_size
                      ? " Serving size: " + recipe.nutrition.serving_size
                      : ""}
                  </Typography>
                  {["per_serving", "total"].map((suffix) => (
                    <Box
                      key={suffix}
                      sx={{
                        mb: 2,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          mb: 1,
                        }}
                      >
                        {suffix === "per_serving"
                          ? "Per serving"
                          : "Total recipe"}
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2,1fr)",
                          gap: 1,
                        }}
                      >
                        {nutritionFields.map(([field, label, unit]) => (
                          <Box key={field}>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                              }}
                            >
                              {label}
                            </Typography>
                            <Typography variant="body2">
                              {recipe.nutrition[field + "_" + suffix] ?? "—"}
                              {recipe.nutrition[field + "_" + suffix] != null
                                ? " " + unit
                                : ""}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    mb: 1,
                  }}
                >
                  No nutrition information.
                </Typography>
              )}
              <Button
                onClick={() => {
                  setNutrition(recipe.nutrition || {});
                  setNutritionEdit(true);
                }}
                size="small"
              >
                Edit nutrition
              </Button>
            </AccordionDetails>
          </Accordion>
        </Stack>
        <Stack spacing={2.5}>
          {recipe.cover_url && (
            <Box
              component="img"
              src={recipe.cover_url}
              alt={recipe.title}
              sx={{
                width: "100%",
                maxHeight: 300,
                objectFit: "cover",
                borderRadius: 3,
              }}
            />
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
            <Typography
              variant="h2"
              sx={{
                mb: 2.5,
              }}
            >
              Method
            </Typography>
            {steps.length ? (
              steps.map((step, index) => (
                <Stack
                  key={index}
                  direction="row"
                  spacing={2}
                  sx={{
                    mb: index === steps.length - 1 ? 0 : 3,
                  }}
                >
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      bgcolor: pastelColors[index % 6],
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography
                    sx={{
                      pt: 0.25,
                    }}
                  >
                    {step}
                  </Typography>
                </Stack>
              ))
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                }}
              >
                No steps added.
              </Typography>
            )}
          </Paper>
          {linked.length > 0 && (
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 3,
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
                <Typography variant="h2">Photos</Typography>
                <Button size="small" onClick={() => setUpload(true)}>
                  Add photo
                </Button>
              </Stack>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 1,
                }}
              >
                {linked.map((p) => (
                  <Box key={p.id}>
                    <Box
                      component="a"
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Box
                        component="img"
                        src={p.thumbnail_url || p.url}
                        alt={p.caption || "Recipe photo"}
                        loading="lazy"
                        sx={{
                          aspectRatio: 1,
                          objectFit: "cover",
                          borderRadius: 2,
                          width: "100%",
                        }}
                      />
                    </Box>
                    <Button
                      size="small"
                      onClick={async () => {
                        try {
                          await api(`/recipes/${recipe.id}`, "PUT", {
                            cover_photo_id: p.id,
                          });
                          await reload("recipes");
                          ui.notify("Cover updated.");
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                      sx={{
                        fontSize: ".7rem",
                        px: 0.5,
                        width: "100%",
                      }}
                    >
                      Use as cover
                    </Button>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
          {recipe.original_url && /^https?:\/\//i.test(recipe.original_url) && (
            <Button
              href={recipe.original_url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={
                <OpenInNewRounded
                  sx={{
                    fontSize: "small",
                  }}
                />
              }
              sx={{
                alignSelf: "start",
              }}
              color="inherit"
            >
              Original recipe
            </Button>
          )}
        </Stack>
      </Box>
      {transfer && (
        <Transfer
          ingredients={(selected.length
            ? selected.map((i) => ingredients[i])
            : ingredients
          ).map((text) => scaleIngredient(text, factor))}
          onClose={() => setTransfer(false)}
        />
      )}{" "}
      {upload && (
        <PhotoUpload recipeId={recipe.id} onClose={() => setUpload(false)} />
      )}
      <Dialog
        open={nutritionEdit}
        onClose={() => !busy && setNutritionEdit(false)}
        aria-labelledby="nutrition-title"
      >
        <DialogTitle id="nutrition-title">Nutrition</DialogTitle>
        <DialogContent>
          <TextField
            label="Serving size"
            fullWidth
            value={nutrition.serving_size || ""}
            onChange={(e) =>
              setNutrition({
                ...nutrition,
                serving_size: e.target.value,
              })
            }
            sx={{
              mt: 1,
              mb: 2,
            }}
          />
          {["per_serving", "total"].map((suffix) => (
            <Box
              key={suffix}
              sx={{
                mb: 2,
              }}
            >
              <Typography
                variant="h3"
                sx={{
                  mb: 2,
                }}
              >
                {suffix === "per_serving" ? "Per serving" : "Total recipe"}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                }}
              >
                {nutritionFields.map(([field, label, unit]) => (
                  <TextField
                    key={field}
                    label={`${label} (${unit})`}
                    type="number"
                    value={nutrition[field + "_" + suffix] ?? ""}
                    onChange={(e) =>
                      setNutrition({
                        ...nutrition,
                        [field + "_" + suffix]: e.target.value,
                      })
                    }
                    slotProps={{
                      htmlInput: {
                        min: 0,
                        step: "any",
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          ))}
          <ErrorText error={error} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNutritionEdit(false)} disabled={busy}>
            Cancel
          </Button>
          <ActionButton busy={busy} variant="contained" onClick={saveNutrition}>
            Save nutrition
          </ActionButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
