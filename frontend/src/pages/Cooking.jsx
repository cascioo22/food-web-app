import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import ViewAgendaOutlined from "@mui/icons-material/ViewAgendaOutlined";
import CenterFocusStrongOutlined from "@mui/icons-material/CenterFocusStrongOutlined";
import { useData } from "../App";
import { lines, readStored, writeStored } from "../lib/api";
import { State, useUI } from "../components/UI";
import Transfer from "../components/Transfer";
import FoodIllustration from "../components/FoodIllustration";
import Timers from "../components/Timers";
const fresh = () => ({
  ingredients: {},
  steps: {},
  current: 0,
  focused: false,
});
export default function Cooking() {
  const { recipes, route, loading, errors, reload } = useData();
  const id = Number(route.params.get("recipe_id")),
    recipe = recipes.find((r) => r.id === id);
  return recipe ? (
    <CookingRecipe key={id} recipe={recipe} />
  ) : (
    <State
      loading={loading.recipes}
      error={errors.recipes || "Choose a recipe to start cooking."}
      onRetry={() => reload("recipes").catch(() => {})}
    />
  );
}
function CookingRecipe({ recipe }) {
  const { navigate } = useData(),
    ui = useUI();
  const ingredientLines = lines(recipe.ingredients_text),
    steps = lines(recipe.steps_ordered),
    fingerprint = JSON.stringify([ingredientLines, steps]),
    key = `fw_cooking_${recipe.id}`;
  const [progress, setProgress] = useState(() => {
      const stored = readStored(key, null);
      return stored?.fingerprint === fingerprint
        ? {
            ...fresh(),
            ...stored,
            current: Math.max(
              0,
              Math.min(steps.length - 1, Number(stored.current) || 0),
            ),
          }
        : fresh();
    }),
    [transfer, setTransfer] = useState(false);
  useEffect(() => {
    const old = readStored(key, null);
    if (old && old.fingerprint !== fingerprint)
      ui.notify("The recipe changed. Cooking progress has been reset.");
  }, []);
  useEffect(() => {
    if (
      !writeStored(key, {
        ...progress,
        fingerprint,
      })
    )
      ui.notify(
        "Progress could not be saved in this browser.",
        null,
        "",
        "warning",
      );
  }, [progress]);
  const completed = steps.filter((_, index) => progress.steps[index]).length;
  const move = (direction) =>
    setProgress((p) => ({
      ...p,
      current: Math.max(0, Math.min(steps.length - 1, p.current + direction)),
    }));
  useEffect(() => {
    const handler = (e) => {
      if (
        e.target.matches("input,textarea,select") ||
        document.querySelector('[role="dialog"]')
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [steps.length]);
  return (
    <Box
      sx={{
        maxWidth: 1000,
        mx: "auto",
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
        <Button
          startIcon={<ArrowBackRounded />}
          color="inherit"
          onClick={() => navigate(`/index.html?recipe=${recipe.id}`)}
          sx={{
            ml: -1.5,
          }}
        >
          Recipe
        </Button>
        <Tooltip title="Reset cooking progress">
          <IconButton
            aria-label="Reset cooking progress"
            onClick={async () => {
              if (
                await ui.confirm(
                  "Reset ingredient and step checkmarks? Timers will keep running.",
                  "Reset progress",
                )
              )
                setProgress(fresh());
            }}
          >
            <RestartAltRounded />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box
          sx={{
            bgcolor: "#FFF2D7",
            borderRadius: 3,
            display: {
              xs: "none",
              sm: "block",
            },
          }}
        >
          <FoodIllustration kind={4} size={64} />
        </Box>
        <Box
          sx={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <Typography
            variant="h1"
            sx={{
              fontSize: {
                xs: "1.55rem",
                sm: "1.9rem",
              },
            }}
          >
            {recipe.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 0.75,
            }}
          >
            {completed} of {steps.length} steps complete
          </Typography>
        </Box>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={steps.length ? (completed / steps.length) * 100 : 0}
        sx={{
          mb: 3,
          bgcolor: "#EFE9F8",
        }}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(220px,.75fr) minmax(0,1.4fr)",
          },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Accordion
          defaultExpanded
          sx={{
            bgcolor: "#F3F8F1",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreRounded />}>
            <Typography variant="h2">Ingredients</Typography>
          </AccordionSummary>
          <AccordionDetails
            sx={{
              pt: 0,
              px: 1.5,
            }}
          >
            {ingredientLines.map((line, index) => (
              <Box
                component="label"
                key={index}
                sx={{
                  display: "flex",
                  alignItems: "start",
                  py: 0.5,
                  borderBottom: index === ingredientLines.length - 1 ? 0 : 1,
                  borderColor: "#E0EADC",
                  cursor: "pointer",
                }}
              >
                <Checkbox
                  checked={!!progress.ingredients[index]}
                  onChange={(e) =>
                    setProgress((p) => ({
                      ...p,
                      ingredients: {
                        ...p.ingredients,
                        [index]: e.target.checked,
                      },
                    }))
                  }
                />
                <Typography
                  sx={{
                    py: 1.1,
                    textDecoration: progress.ingredients[index]
                      ? "line-through"
                      : undefined,
                    color: progress.ingredients[index]
                      ? "text.secondary"
                      : "text.primary",
                  }}
                >
                  {line}
                </Typography>
              </Box>
            ))}
            <Button
              fullWidth
              onClick={() => setTransfer(true)}
              disabled={
                !ingredientLines.some((_, i) => !progress.ingredients[i])
              }
              sx={{
                mt: 1,
                fontSize: ".8rem",
              }}
            >
              Add unchecked to a list
            </Button>
          </AccordionDetails>
        </Accordion>
        <Box>
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
              size="small"
              startIcon={
                progress.focused ? (
                  <ViewAgendaOutlined />
                ) : (
                  <CenterFocusStrongOutlined />
                )
              }
              onClick={() =>
                setProgress((p) => ({
                  ...p,
                  focused: !p.focused,
                }))
              }
            >
              {progress.focused ? "All steps" : "Focus mode"}
            </Button>
          </Stack>
          {steps.length === 0 && (
            <Typography
              sx={{
                color: "text.secondary",
              }}
            >
              No instructions in this recipe.
            </Typography>
          )}
          {steps.map((step, index) =>
            progress.focused && progress.current !== index ? null : (
              <Paper
                key={index}
                variant="outlined"
                data-testid="cooking-step"
                sx={{
                  p: {
                    xs: 2,
                    sm: 2.5,
                  },
                  mb: 1.5,
                  borderRadius: 3,
                  borderColor:
                    progress.current === index ? "primary.main" : "divider",
                  bgcolor:
                    progress.current === index ? "#FFF8FB" : "background.paper",
                  borderWidth: progress.current === index ? 1.5 : 1,
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{
                    alignItems: "start",
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: progress.steps[index] ? "#E7F1E9" : "#EFE9F8",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      mt: 0.75,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Box
                    component="label"
                    sx={{
                      display: "flex",
                      alignItems: "start",
                      flex: 1,
                      cursor: "pointer",
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      sx={{
                        flex: 1,
                        fontSize: "1.05rem",
                        lineHeight: 1.75,
                        pt: 0.5,
                        color: progress.steps[index]
                          ? "text.secondary"
                          : "text.primary",
                        textDecoration: progress.steps[index]
                          ? "line-through"
                          : undefined,
                      }}
                    >
                      {step}
                    </Typography>
                    <Checkbox
                      checked={!!progress.steps[index]}
                      onChange={(e) =>
                        setProgress((p) => ({
                          ...p,
                          current: index,
                          steps: {
                            ...p.steps,
                            [index]: e.target.checked,
                          },
                        }))
                      }
                      slotProps={{
                        input: {
                          "aria-label": `Complete step ${index + 1}`,
                        },
                      }}
                      sx={{
                        p: 1,
                        ml: 1,
                      }}
                    />
                  </Box>
                </Stack>
              </Paper>
            ),
          )}
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              mt: 2.5,
            }}
          >
            <Button
              startIcon={<ArrowBackRounded />}
              onClick={() => move(-1)}
              disabled={progress.current === 0}
            >
              Previous
            </Button>
            <Typography
              variant="caption"
              role="status"
              sx={{
                color: "text.secondary",
              }}
            >
              {steps.length ? progress.current + 1 : 0} / {steps.length}
            </Typography>
            <Button
              variant="contained"
              endIcon={<ArrowForwardRounded />}
              onClick={() => move(1)}
              disabled={progress.current >= steps.length - 1}
            >
              Next
            </Button>
          </Stack>
          <Timers recipeId={recipe.id} />
        </Box>
      </Box>
      {transfer && (
        <Transfer
          ingredients={ingredientLines.filter(
            (_, index) => !progress.ingredients[index],
          )}
          onClose={() => setTransfer(false)}
        />
      )}
    </Box>
  );
}
