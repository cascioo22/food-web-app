import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import { useData } from "../App";
import { api } from "../lib/api";
import {
  ActionButton,
  ErrorText,
  PageTitle,
  State,
  useUI,
} from "../components/UI";
import PhotoUpload from "../components/PhotoUpload";
import FoodIllustration from "../components/FoodIllustration";
export default function Photos() {
  const { photos, recipes, loading, errors, reload } = useData(),
    ui = useUI();
  const [upload, setUpload] = useState(false),
    [selected, setSelected] = useState(null),
    [caption, setCaption] = useState(""),
    [recipe, setRecipe] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const open = (photo) => {
    setSelected(photo);
    setCaption(photo.caption || "");
    setRecipe(photo.recipe_id || "");
    setError("");
  };
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/photos/${selected.id}`, "PUT", {
        caption,
        recipe_id: recipe ? Number(recipe) : null,
      });
      await Promise.all([reload("photos"), reload("recipes")]);
      setSelected(null);
      ui.notify("Photo updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (await ui.confirm("Delete this photo? This cannot be undone.")) {
      setBusy(true);
      try {
        await api(`/photos/${selected.id}`, "DELETE");
        await Promise.all([reload("photos"), reload("recipes")]);
        setSelected(null);
        ui.notify("Photo deleted.");
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }
  }
  return (
    <>
      <PageTitle
        title="Photos"
        count={`${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
      >
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => setUpload(true)}
        >
          Add photo
        </Button>
      </PageTitle>
      <State
        loading={loading.photos}
        error={errors.photos}
        onRetry={() => reload("photos").catch(() => {})}
        empty={!photos.length}
        title="Something worth saving"
        description="Add a photo of what you’ve made."
        action={
          <>
            <FoodIllustration
              kind={4}
              size={100}
              sx={{
                mx: "auto",
                mb: 1,
              }}
            />
            <Button onClick={() => setUpload(true)}>Add a photo</Button>
          </>
        }
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr 1fr",
            sm: "repeat(3,1fr)",
            md: "repeat(4,1fr)",
          },
          gap: {
            xs: 1.5,
            sm: 2,
          },
        }}
      >
        {photos.map((p) => (
          <Paper
            key={p.id}
            variant="outlined"
            sx={{
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <ButtonBase
              aria-label={`View ${p.caption || "photo"}`}
              onClick={() => open(p)}
              sx={{
                display: "block",
                width: "100%",
                textAlign: "left",
              }}
            >
              <Box
                component="img"
                src={p.thumbnail_url || p.url}
                alt={p.caption || "Food photo"}
                loading="lazy"
                sx={{
                  width: "100%",
                  aspectRatio: 1,
                  objectFit: "cover",
                }}
              />
              <Box
                sx={{
                  p: 1.5,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  {p.caption || "Untitled photo"}
                </Typography>
                {p.recipe_id && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                    }}
                  >
                    {recipes.find((r) => r.id === p.recipe_id)?.title ||
                      "Recipe"}
                  </Typography>
                )}
              </Box>
            </ButtonBase>
          </Paper>
        ))}
      </Box>
      {upload && <PhotoUpload onClose={() => setUpload(false)} />}
      <Dialog
        open={!!selected}
        onClose={() => !busy && setSelected(null)}
        aria-labelledby="photo-title"
      >
        <DialogTitle id="photo-title">Photo</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5}>
            {selected && (
              <Box
                component="img"
                src={selected.url}
                alt={selected.caption || "Food photo"}
                sx={{
                  width: "100%",
                  maxHeight: 350,
                  objectFit: "contain",
                  borderRadius: 2,
                }}
              />
            )}
            <TextField
              label="Caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <FormControl>
              <InputLabel id="photo-recipe-label">Recipe</InputLabel>
              <Select
                labelId="photo-recipe-label"
                label="Recipe"
                value={recipe}
                onChange={(e) => setRecipe(e.target.value)}
              >
                <MenuItem value="">No recipe</MenuItem>
                {recipes.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {recipe && (
              <Button
                onClick={async () => {
                  try {
                    await api(`/recipes/${recipe}`, "PUT", {
                      cover_photo_id: selected.id,
                    });
                    await reload("recipes");
                    ui.notify("Cover updated.");
                  } catch (e) {
                    setError(e.message);
                  }
                }}
                disabled={Number(recipe) !== selected?.recipe_id}
              >
                Use as recipe cover
              </Button>
            )}
            <ErrorText error={error} />
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: "space-between",
          }}
        >
          <Button
            color="error"
            disabled={busy}
            startIcon={<DeleteOutlineRounded />}
            onClick={remove}
          >
            Delete
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setSelected(null)} disabled={busy}>
              Cancel
            </Button>
            <ActionButton busy={busy} variant="contained" onClick={save}>
              Save changes
            </ActionButton>
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  );
}
