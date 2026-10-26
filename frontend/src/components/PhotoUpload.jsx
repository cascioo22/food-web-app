import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import { useData } from "../App";
import { ActionButton, ErrorText, useUI } from "./UI";
import { api } from "../lib/api";
export default function PhotoUpload({ recipeId = null, onClose }) {
  const { recipes, reload } = useData(),
    ui = useUI();
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(""),
    [caption, setCaption] = useState(""),
    [target, setTarget] = useState(recipeId || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function pick(e) {
    const image = e.target.files[0];
    if (!image) return;
    if (image.size > 10 * 1024 * 1024) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    setFile(image);
    setError("");
  }
  async function upload(e) {
    e.preventDefault();
    if (busy) return;
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("image", file);
      data.append("caption", caption);
      if (target) data.append("recipe_id", target);
      await api("/photos", "POST", data);
      await Promise.all([reload("photos"), reload("recipes")]);
      ui.notify("Photo added.");
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      aria-labelledby="upload-title"
    >
      <Box component="form" onSubmit={upload} noValidate>
        <DialogTitle id="upload-title">Add a photo</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5}>
            <input
              ref={input}
              type="file"
              accept="image/*"
              onChange={pick}
              hidden
              aria-label="Choose photo"
            />
            <Button
              variant="outlined"
              startIcon={<AddPhotoAlternateOutlined />}
              onClick={() => input.current?.click()}
            >
              {file ? "Choose a different photo" : "Choose photo"}
            </Button>
            {preview && (
              <Box
                component="img"
                src={preview}
                alt="Selected photo preview"
                sx={{
                  maxHeight: 280,
                  width: "100%",
                  objectFit: "contain",
                  borderRadius: 2,
                  bgcolor: "#FAF7FA",
                }}
              />
            )}
            <TextField
              label="Caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="upload-recipe-label">Recipe</InputLabel>
              <Select
                labelId="upload-recipe-label"
                label="Recipe"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <MenuItem value="">No recipe</MenuItem>
                {recipes.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <ErrorText error={error} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <ActionButton type="submit" variant="contained" busy={busy}>
            Upload photo
          </ActionButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
