import { useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
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
  Alert,
} from "@mui/material";
import { useData } from "../App";
import { api } from "../lib/api";
import { ActionButton, useUI } from "./UI";
export default function Transfer({ ingredients, onClose }) {
  const { lists, reload } = useData(),
    ui = useUI();
  const [rows, setRows] = useState(() =>
      ingredients.map((name, index) => ({
        id: index,
        name,
        selected: true,
        quantity: "",
        unit: "",
      })),
    ),
    [target, setTarget] = useState(lists[0]?.id || "new"),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [policy, setPolicy] = useState("keep");
  const operation = useRef(null),
    created = useRef(null);
  const change = (index, data) => {
    setRows((v) =>
      v.map((r, i) =>
        i === index
          ? {
              ...r,
              ...data,
            }
          : r,
      ),
    );
  };
  async function save() {
    if (busy) return;
    const items = rows
      .filter((r) => r.selected)
      .map(({ name, quantity, unit }) => ({
        name: name.trim(),
        quantity,
        unit,
      }));
    if (!items.length || items.some((i) => !i.name)) {
      setError("Select at least one ingredient with a name.");
      return;
    }
    if (target === "new" && !name.trim()) {
      setError("Enter a list name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let id = target;
      if (id === "new") {
        if (!created.current)
          created.current = (
            await api("/grocery-lists", "POST", {
              name: name.trim(),
            })
          ).id;
        id = created.current;
        await reload("lists");
        setTarget(id);
      }
      const signature = JSON.stringify({
        id,
        items,
        policy,
      });
      if (operation.current?.signature !== signature)
        operation.current = {
          signature,
          key: crypto.randomUUID(),
        };
      const result = await api(`/grocery-lists/${id}/items/bulk`, "POST", {
        items,
        operation_id: operation.current.key,
        duplicate_policy: policy,
      });
      await reload("lists");
      ui.notify(
        `${result.added_count} ingredients added${result.merged_count ? `, ${result.merged_count} merged` : ""}.`,
      );
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const existing = lists.find((l) => l.id === Number(target));
  const duplicates = rows.filter(
    (r) =>
      r.selected &&
      existing?.items.some(
        (i) => i.name.toLocaleLowerCase() === r.name.toLocaleLowerCase(),
      ),
  ).length;
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      aria-labelledby="transfer-title"
    >
      <DialogTitle id="transfer-title">Add ingredients to a list</DialogTitle>
      <DialogContent>
        <Stack
          spacing={2}
          sx={{
            pt: 1,
          }}
        >
          <FormControl fullWidth>
            <InputLabel id="destination-label">Grocery list</InputLabel>
            <Select
              labelId="destination-label"
              label="Grocery list"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {lists.map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
              <MenuItem value="new">+ New list</MenuItem>
            </Select>
          </FormControl>
          {target === "new" && (
            <TextField
              label="List name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          {duplicates > 0 && (
            <Alert severity="info">
              {duplicates} ingredients already appear on this list. They’ll be
              kept separately.
            </Alert>
          )}
          <Box
            sx={{
              maxHeight: "45vh",
              overflow: "auto",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            {rows.map((row, index) => (
              <Box
                key={row.id}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderBottom: index === rows.length - 1 ? 0 : 1,
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: "center",
                  }}
                >
                  <Checkbox
                    checked={row.selected}
                    onChange={(e) =>
                      change(index, {
                        selected: e.target.checked,
                      })
                    }
                    slotProps={{
                      input: {
                        "aria-label": `Include ingredient ${index + 1}`,
                      },
                    }}
                  />
                  <TextField
                    fullWidth
                    variant="standard"
                    value={row.name}
                    onChange={(e) =>
                      change(index, {
                        name: e.target.value,
                      })
                    }
                    slotProps={{
                      htmlInput: {
                        "aria-label": `Ingredient ${index + 1} wording`,
                      },
                    }}
                  />
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    pl: 5.5,
                    mt: 1,
                  }}
                >
                  <TextField
                    label="Quantity"
                    value={row.quantity}
                    onChange={(e) =>
                      change(index, {
                        quantity: e.target.value,
                      })
                    }
                    size="small"
                  />
                  <TextField
                    label="Unit"
                    value={row.unit}
                    onChange={(e) =>
                      change(index, {
                        unit: e.target.value,
                      })
                    }
                    size="small"
                  />
                </Stack>
              </Box>
            ))}
          </Box>
          <FormControl>
            <InputLabel id="duplicates-label">Duplicates</InputLabel>
            <Select
              labelId="duplicates-label"
              label="Duplicates"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
            >
              <MenuItem value="keep">Keep separate</MenuItem>
              <MenuItem value="merge">
                Merge matching numeric quantities
              </MenuItem>
            </Select>
          </FormControl>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <ActionButton busy={busy} variant="contained" onClick={save}>
          Add ingredients
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
