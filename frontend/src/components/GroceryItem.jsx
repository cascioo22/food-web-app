import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { ActionButton, Overflow } from "../components/UI";
import { SortableRow } from "../components/Reorder";
const categories = [
  "",
  "Produce",
  "Meat and seafood",
  "Dairy and eggs",
  "Pantry",
  "Frozen",
  "Bakery",
  "Household",
  "Other",
];
export default function GroceryItem({
  item,
  last,
  position,
  length,
  prefs,
  busy,
  canReorder,
  editing,
  setEditing,
  selected,
  setSelected,
  beginEdit,
  saveItem,
  toggle,
  remove,
  moveItem,
}) {
  return (
    <SortableRow id={item.id} label={item.name} disabled={!canReorder}>
      {(handle) => (
        <Box
          data-testid="grocery-row"
          data-id={item.id}
          sx={{
            borderBottom: last ? 0 : 1,
            borderColor: "divider",
            bgcolor: item.completed ? "#FCFAFB" : "background.paper",
          }}
        >
          {editing?.id === item.id ? (
            <Box
              component="form"
              onSubmit={saveItem}
              sx={{
                p: 2,
                bgcolor: "#FCF6F9",
              }}
            >
              <Stack spacing={2}>
                <TextField
                  label="Item name"
                  autoFocus
                  fullWidth
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      name: e.target.value,
                    })
                  }
                />
                <Stack direction="row" spacing={1.5}>
                  <TextField
                    label="Quantity"
                    value={editing.quantity}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        quantity: e.target.value,
                      })
                    }
                  />
                  <TextField
                    label="Unit"
                    value={editing.unit}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        unit: e.target.value,
                      })
                    }
                  />
                </Stack>
                <FormControl fullWidth>
                  <InputLabel id="item-category-label">Category</InputLabel>
                  <Select
                    labelId="item-category-label"
                    label="Category"
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        category: e.target.value,
                      })
                    }
                  >
                    {[...new Set([...categories, editing.category])].map(
                      (c) => (
                        <MenuItem key={c} value={c}>
                          {c || "No category"}
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
                <TextField
                  label="Notes"
                  multiline
                  value={editing.notes}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      notes: e.target.value,
                    })
                  }
                />
                <Stack direction="row" spacing={1}>
                  <ActionButton type="submit" variant="contained" busy={busy}>
                    Save item
                  </ActionButton>
                  <Button onClick={() => setEditing(null)} disabled={busy}>
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            </Box>
          ) : (
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                pl: prefs.shopping ? 1 : 0.75,
                pr: 1,
                minHeight: prefs.shopping ? 78 : 64,
              }}
            >
              {!prefs.shopping && handle}
              <Checkbox
                checked={!!item.completed}
                disabled={busy}
                onChange={() => toggle(item)}
                slotProps={{
                  input: {
                    "aria-label": `Purchased ${item.name}`,
                  },
                }}
                sx={{
                  "& .MuiSvgIcon-root": {
                    fontSize: prefs.shopping ? 30 : 26,
                  },
                  color: "#B7A6B6",
                }}
              />
              <ButtonBase
                onClick={() => beginEdit(item)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  display: "block",
                  py: 1.5,
                  px: 0.75,
                  borderRadius: 1,
                }}
              >
                <Typography
                  className="item-name"
                  sx={{
                    fontSize: prefs.shopping ? "1.05rem" : ".9375rem",
                    textDecoration: item.completed ? "line-through" : undefined,
                    color: item.completed ? "text.secondary" : "text.primary",
                  }}
                >
                  {item.name}
                </Typography>
                {(item.quantity || item.unit) && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                    }}
                  >
                    {[item.quantity, item.unit].filter(Boolean).join(" ")}
                  </Typography>
                )}
                {item.notes && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                    }}
                  >
                    {item.notes}
                  </Typography>
                )}
              </ButtonBase>
              {selected.includes(item.id) && (
                <CheckRounded
                  color="secondary"
                  sx={{
                    fontSize: 16,
                  }}
                />
              )}
              <Overflow
                label={`Actions for ${item.name}`}
                disabled={busy}
                items={[
                  {
                    label: "Edit item",
                    icon: (
                      <EditOutlined
                        sx={{
                          fontSize: "small",
                        }}
                      />
                    ),
                    action: () => beginEdit(item),
                  },
                  {
                    label: selected.includes(item.id)
                      ? "Deselect"
                      : "Select to move or copy",
                    action: () =>
                      setSelected((v) =>
                        v.includes(item.id)
                          ? v.filter((i) => i !== item.id)
                          : [...v, item.id],
                      ),
                  },
                  {
                    label: "Move up",
                    disabled: !canReorder || position === 0,
                    icon: (
                      <ArrowUpwardRounded
                        sx={{
                          fontSize: "small",
                        }}
                      />
                    ),
                    action: () => moveItem(position, -1),
                  },
                  {
                    label: "Move down",
                    disabled: !canReorder || position === length - 1,
                    icon: (
                      <ArrowDownwardRounded
                        sx={{
                          fontSize: "small",
                        }}
                      />
                    ),
                    action: () => moveItem(position, 1),
                  },
                  {
                    label: "Delete item",
                    danger: true,
                    icon: (
                      <DeleteOutlineRounded
                        sx={{
                          fontSize: "small",
                        }}
                      />
                    ),
                    action: () => remove(item),
                  },
                ]}
              />
            </Stack>
          )}
        </Box>
      )}
    </SortableRow>
  );
}
