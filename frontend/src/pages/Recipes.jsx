import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Card,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FavoriteBorderRounded from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import PeopleOutlineRounded from "@mui/icons-material/PeopleOutlineRounded";
import { useData } from "../App";
import { api } from "../lib/api";
import { ErrorText, Overflow, PageTitle, State, useUI } from "../components/UI";
import RecipeEditor from "../components/RecipeEditor";
import FoodIllustration, { pastelColors } from "../components/FoodIllustration";
import RecipeDetail from "../components/RecipeDetail";
export default function Recipes() {
  const { recipes, loading, errors, reload, route, navigate } = useData(),
    ui = useUI();
  const [query, setQuery] = useState(route.params.get("q") || ""),
    [category, setCategory] = useState(route.params.get("category") || ""),
    [sort, setSort] = useState(route.params.get("sort") || "recent"),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [error, setError] = useState("");
  const recipeId = Number(route.params.get("recipe")),
    editId = Number(route.params.get("edit")),
    creating = route.params.has("new"),
    recipe = recipes.find((r) => r.id === (editId || recipeId));
  const categories = [
    ...new Set(recipes.map((r) => r.category).filter(Boolean)),
  ].sort();
  const filtered = useMemo(() => {
    const value = recipes.filter(
      (r) =>
        (!onlyFavorites || r.favorite) &&
        (!category || r.category === category) &&
        [r.title, r.ingredients_text, r.category, r.notes, r.description]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    );
    const minutes = (r) => {
      const v = r.prep_time || "";
      const match = v.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
      return match
        ? Number(match[1] || 0) * 60 + Number(match[2] || 0)
        : parseFloat(v) * (/hour|hr/i.test(v) ? 60 : 1) || Infinity;
    };
    return value.sort((a, b) =>
      sort === "alpha"
        ? a.title.localeCompare(b.title)
        : sort === "time"
          ? minutes(a) - minutes(b)
          : sort === "favorites"
            ? Number(b.favorite) - Number(a.favorite) || b.id - a.id
            : sort === "cooked"
              ? String(b.last_cooked_at || "").localeCompare(
                  a.last_cooked_at || "",
                )
              : b.id - a.id,
    );
  }, [recipes, query, category, sort, onlyFavorites]);
  useEffect(() => {
    if (recipeId || editId || creating) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (sort !== "recent") params.set("sort", sort);
    history.replaceState(
      {},
      "",
      location.pathname + (params.size ? "?" + params : ""),
    );
  }, [query, category, sort, recipeId, editId, creating]);
  async function remove(r) {
    if (
      await ui.confirm(
        `Delete “${r.title}”? Its photos will remain in your gallery.`,
      )
    ) {
      try {
        await api(`/recipes/${r.id}`, "DELETE");
        await reload("recipes");
        if (recipeId) navigate("/index.html");
        ui.notify("Recipe deleted.");
      } catch (e) {
        setError(e.message);
      }
    }
  }
  async function favorite(r) {
    try {
      await api(`/recipes/${r.id}`, "PUT", {
        favorite: !r.favorite,
      });
      await reload("recipes");
    } catch (e) {
      ui.notify(e.message, null, "", "error");
    }
  }
  if (creating || editId) {
    if (editId && !recipe)
      return (
        <State
          loading={loading.recipes}
          error={errors.recipes || "Recipe not found."}
          onRetry={() => reload("recipes").catch(() => {})}
        />
      );
    return <RecipeEditor key={editId || "new"} recipe={recipe} />;
  }
  if (recipeId) {
    if (!recipe)
      return (
        <State
          loading={loading.recipes}
          error={errors.recipes || "Recipe not found."}
          onRetry={() => reload("recipes").catch(() => {})}
        />
      );
    return (
      <RecipeDetail
        key={recipeId}
        recipe={recipe}
        onDelete={() => remove(recipe)}
        onFavorite={() => favorite(recipe)}
      />
    );
  }
  return (
    <>
      <PageTitle
        title="Recipes"
        count={`${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`}
      >
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/index.html?new=1")}
        >
          Add recipe
        </Button>
      </PageTitle>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "minmax(200px,1fr) auto",
          },
          gap: 2,
          mb: 2.5,
        }}
      >
        <TextField
          label="Search recipes"
          placeholder="Name or ingredient"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded
                    sx={{
                      fontSize: 20,
                    }}
                  />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <IconButton
                  size="small"
                  aria-label="Clear recipe search"
                  onClick={() => setQuery("")}
                >
                  <CloseRounded
                    sx={{
                      fontSize: "small",
                    }}
                  />
                </IconButton>
              ) : null,
            },
          }}
        />
        <Box
          sx={{
            display: "flex",
            gap: 1,
            minWidth: 0,
          }}
        >
          <FormControl
            sx={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <InputLabel id="recipe-category-label">Category</InputLabel>
            <Select
              labelId="recipe-category-label"
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              sx={{
                minWidth: {
                  sm: 150,
                },
              }}
            >
              <MenuItem value="">All categories</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl
            sx={{
              minWidth: 0,
              flex: 1,
            }}
          >
            <InputLabel id="recipe-sort-label">Sort</InputLabel>
            <Select
              labelId="recipe-sort-label"
              label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              sx={{
                minWidth: {
                  sm: 170,
                },
              }}
            >
              {[
                ["recent", "Newest"],
                ["alpha", "A–Z"],
                ["time", "Prep time"],
                ["favorites", "Favorites first"],
                ["cooked", "Recently cooked"],
              ].map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Favorites only">
            <IconButton
              aria-label="Favorites only"
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              sx={{
                border: 1,
                borderColor: onlyFavorites ? "primary.main" : "divider",
                height: 42,
                width: 42,
                color: onlyFavorites ? "primary.main" : "text.secondary",
                bgcolor: onlyFavorites ? "primary.light" : "background.paper",
              }}
            >
              {onlyFavorites ? (
                <FavoriteRounded
                  sx={{
                    fontSize: "small",
                  }}
                />
              ) : (
                <FavoriteBorderRounded
                  sx={{
                    fontSize: "small",
                  }}
                />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <ErrorText error={error} />
      <State
        loading={loading.recipes}
        error={errors.recipes}
        onRetry={() => reload("recipes").catch(() => {})}
        empty={!loading.recipes && !filtered.length}
        title={
          recipes.length
            ? "No matching recipes"
            : "A little collection of favorites"
        }
        description={
          recipes.length
            ? "Try another search or filter."
            : "Save your first recipe to get started."
        }
        action={
          !recipes.length ? (
            <Button onClick={() => navigate("/index.html?new=1")}>
              Add a recipe
            </Button>
          ) : null
        }
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            lg: "1fr 1fr 1fr",
          },
          gap: 2,
        }}
      >
        {filtered.map((r, index) => (
          <Card
            key={r.id}
            variant="outlined"
            data-testid="recipe-card"
            sx={{
              borderRadius: 3,
              overflow: "hidden",
              position: "relative",
              transition: "box-shadow .15s",
              "&:hover": {
                boxShadow: "0 6px 20px #8A6A8112",
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "stretch",
                height: "100%",
              }}
            >
              <ButtonBase
                onClick={() => navigate(`/index.html?recipe=${r.id}`)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  textAlign: "left",
                  alignItems: "center",
                  p: 2,
                  gap: 1.75,
                }}
              >
                {r.cover_url ? (
                  <Box
                    component="img"
                    loading="lazy"
                    src={r.cover_url}
                    alt=""
                    sx={{
                      height: 90,
                      width: 82,
                      objectFit: "cover",
                      borderRadius: 2,
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 82,
                      height: 90,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: pastelColors[r.id % 6],
                      borderRadius: 2.5,
                      flexShrink: 0,
                    }}
                  >
                    <FoodIllustration kind={r.id % 6} size={78} />
                  </Box>
                )}
                <Box
                  sx={{
                    minWidth: 0,
                    alignSelf: "center",
                    py: 0.5,
                    pr: 2.5,
                  }}
                >
                  {r.category && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        mb: 0.5,
                      }}
                    >
                      {r.category}
                    </Typography>
                  )}
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 650,
                      lineHeight: 1.35,
                      mb: 1,
                    }}
                  >
                    {r.title}
                  </Typography>
                  <Stack
                    direction="row"
                    sx={{
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 1.25,
                    }}
                  >
                    {r.prep_time && (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{
                          alignItems: "center",
                        }}
                      >
                        <ScheduleRounded
                          sx={{
                            fontSize: 14,
                            color: "text.secondary",
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                          }}
                        >
                          {r.prep_time}
                        </Typography>
                      </Stack>
                    )}
                    {r.servings && (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{
                          alignItems: "center",
                        }}
                      >
                        <PeopleOutlineRounded
                          sx={{
                            fontSize: 14,
                            color: "text.secondary",
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                          }}
                        >
                          {r.servings}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Box>
              </ButtonBase>
              <Box
                sx={{
                  position: "absolute",
                  right: 4,
                  top: 4,
                }}
              >
                <Overflow
                  label={`Actions for ${r.title}`}
                  items={[
                    {
                      label: r.favorite ? "Remove favorite" : "Favorite",
                      icon: r.favorite ? (
                        <FavoriteRounded
                          sx={{
                            fontSize: "small",
                          }}
                        />
                      ) : (
                        <FavoriteBorderRounded
                          sx={{
                            fontSize: "small",
                          }}
                        />
                      ),
                      action: () => favorite(r),
                    },
                    {
                      label: "Edit recipe",
                      icon: (
                        <EditOutlined
                          sx={{
                            fontSize: "small",
                          }}
                        />
                      ),
                      action: () => navigate(`/index.html?edit=${r.id}`),
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
                      action: () => remove(r),
                    },
                  ]}
                />
              </Box>
              {r.favorite && (
                <FavoriteRounded
                  sx={{
                    position: "absolute",
                    right: 16,
                    bottom: 15,
                    fontSize: 15,
                    color: "primary.main",
                  }}
                />
              )}
            </Box>
          </Card>
        ))}
      </Box>
    </>
  );
}
