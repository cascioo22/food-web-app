import GroceryItem from "../components/GroceryItem";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Popover,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import IosShareRounded from "@mui/icons-material/IosShareRounded";
import LocalMallOutlined from "@mui/icons-material/LocalMallOutlined";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import { useData } from "../App";
import { api, readStored, writeStored, readDraft, saveDraft } from "../lib/api";
import {
  ActionButton,
  ErrorText,
  Overflow,
  PageTitle,
  State,
  useUI,
} from "../components/UI";
import { SortableGroup, SortableRow } from "../components/Reorder";
import ListExport from "../components/ListExport";
import FoodIllustration from "../components/FoodIllustration";
const colors = ["#FBE9EE", "#E7F1E9", "#EFE9F8", "#FFF2D7"];
const defaults = {
  hide: false,
  bottom: false,
  group: "manual",
  shopping: false,
};
export default function Lists() {
  const { lists, setLists, loading, errors, reload, route, navigate } =
      useData(),
    ui = useUI();
  const id = Number(route.params.get("list")) || null,
    list = lists.find((l) => l.id === id);
  const [dialog, setDialog] = useState(null),
    [newName, setNewName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [exporting, setExporting] = useState(false),
    [optionsAnchor, setOptionsAnchor] = useState(null),
    [prefs, setPrefs] = useState(defaults),
    [query, setQuery] = useState(""),
    [showSearch, setShowSearch] = useState(false),
    [text, setText] = useState(""),
    [editing, setEditing] = useState(null),
    [renaming, setRenaming] = useState(false),
    [title, setTitle] = useState(""),
    [selected, setSelected] = useState([]),
    [destination, setDestination] = useState("");
  const input = useRef(null),
    pending = useRef(null),
    lock = useRef(false);
  useEffect(() => {
    setPrefs({
      ...defaults,
      ...readStored(`fw_list_view_${id}`, {}),
    });
    setText(readDraft(`fw_list_draft_${id}`));
    setEditing(null);
    setRenaming(false);
    setQuery("");
    setSelected([]);
    setError("");
  }, [id]);
  useEffect(() => {
    ui.setDirty(!!editing || renaming);
    return () => ui.setDirty(false);
  }, [!!editing, renaming]);
  const updatePrefs = (data) => {
    const value = {
      ...prefs,
      ...data,
    };
    setPrefs(value);
    writeStored(`fw_list_view_${id}`, value);
  };
  async function run(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    await reload("lists");
  }
  async function removeList(l) {
    if (
      await ui.confirm(
        `Delete “${l.name}” and all its items? This cannot be undone.`,
      )
    )
      run(async () => {
        await api(`/grocery-lists/${l.id}`, "DELETE");
        await refresh();
        if (id === l.id)
          navigate("/lists.html", {
            force: true,
          });
        ui.notify("List deleted.");
      });
  }
  const duplicate = (l) =>
    run(async () => {
      const copy = await api(`/grocery-lists/${l.id}/duplicate`, "POST", {});
      await refresh();
      navigate(`/lists.html?list=${copy.id}`);
      ui.notify("List copied. All items are unchecked.");
    });
  const reorderLists = (ids) =>
    run(async () => {
      await api("/grocery-lists/order", "PUT", {
        ids,
        expected_ids: lists.map((l) => l.id),
      });
      await refresh();
      ui.notify("List order saved.");
    });
  const moveList = (index, offset) => {
    const ids = lists.map((l) => l.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    reorderLists(ids);
  };
  const canReorder =
    !!list &&
    !query &&
    prefs.group === "manual" &&
    !prefs.hide &&
    !prefs.bottom &&
    !editing &&
    !busy;
  const reorderItems = (ids) =>
    run(async () => {
      await api(`/grocery-lists/${id}/items/order`, "PUT", {
        ids,
        expected_revision: list.revision,
      });
      await refresh();
      ui.notify("Item order saved.");
    });
  const moveItem = (index, offset) => {
    const ids = list.items.map((i) => i.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    reorderItems(ids);
  };
  function startName(l) {
    setNewName(l?.name || "");
    setDialog(
      l
        ? {
            id: l.id,
          }
        : {},
    );
    setError("");
  }
  async function saveName(e) {
    e.preventDefault();
    if (!newName.trim()) {
      setError("Enter a list name.");
      return;
    }
    run(async () => {
      const value = await api(
        dialog.id ? `/grocery-lists/${dialog.id}` : "/grocery-lists",
        dialog.id ? "PATCH" : "POST",
        {
          name: newName.trim(),
        },
      );
      await refresh();
      setDialog(null);
      if (!dialog.id) navigate(`/lists.html?list=${value.id}`);
    });
  }
  async function add(e) {
    e.preventDefault();
    const names = text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) {
      input.current?.focus();
      return;
    }
    if (names.length > 500 || names.some((n) => n.length > 1000)) {
      setError("Add up to 500 items at a time, each under 1,000 characters.");
      return;
    }
    if (
      !pending.current ||
      pending.current.text !== text ||
      pending.current.id !== id
    )
      pending.current = {
        text,
        id,
        key: crypto.randomUUID(),
      };
    run(async () => {
      await api(`/grocery-lists/${id}/items/bulk`, "POST", {
        operation_id: pending.current.key,
        items: names.map((name) => ({
          name,
        })),
        duplicate_policy: "keep",
      });
      pending.current = null;
      setText((value) => {
        if (value === text) {
          saveDraft(`fw_list_draft_${id}`, "");
          return "";
        }
        return value;
      });
      await refresh();
      input.current?.focus();
    });
  }
  const toggle = (item) =>
    run(async () => {
      setLists((value) =>
        value.map((l) =>
          l.id === id
            ? {
                ...l,
                items: l.items.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        completed: !item.completed,
                      }
                    : i,
                ),
              }
            : l,
        ),
      );
      try {
        const updated = await api(
          `/grocery-lists/${id}/items/${item.id}`,
          "PATCH",
          {
            completed: !item.completed,
            expected_version: item.version,
          },
        );
        setLists((value) =>
          value.map((l) =>
            l.id === id
              ? {
                  ...l,
                  revision: l.revision + 1,
                  items: l.items.map((i) => (i.id === item.id ? updated : i)),
                }
              : l,
          ),
        );
      } catch (error) {
        setLists((value) =>
          value.map((l) =>
            l.id === id
              ? {
                  ...l,
                  items: l.items.map((i) => (i.id === item.id ? item : i)),
                }
              : l,
          ),
        );
        throw error;
      }
    });
  const remove = (item) =>
    run(async () => {
      const lid = id;
      await api(`/grocery-lists/${lid}/items/${item.id}`, "DELETE");
      setSelected((v) => v.filter((i) => i !== item.id));
      await refresh();
      ui.notify(`${item.name} removed.`, async () => {
        await api(`/grocery-lists/${lid}/restore`, "POST", {
          ids: [item.id],
        });
        await refresh();
      });
    });
  const beginEdit = async (item) => {
    if (
      editing &&
      editing.id !== item.id &&
      !(await ui.confirm(
        "Discard your unsaved item changes?",
        "Discard changes",
      ))
    )
      return;
    setEditing({
      ...item,
    });
  };
  const saveItem = (e) => {
    e.preventDefault();
    if (!editing.name.trim()) {
      setError("Enter an item name.");
      return;
    }
    run(async () => {
      const { name, quantity, unit, category, notes } = editing;
      await api(`/grocery-lists/${id}/items/${editing.id}`, "PATCH", {
        name,
        quantity,
        unit,
        category,
        notes,
        expected_version: editing.version,
      });
      setEditing(null);
      await refresh();
      ui.notify("Item saved.");
    });
  };
  const clearCompleted = () =>
    run(async () => {
      const lid = id;
      const result = await api(
        `/grocery-lists/${lid}/clear-completed`,
        "POST",
        {
          expected_revision: list.revision,
        },
      );
      await refresh();
      if (result.ids.length)
        ui.notify(`${result.ids.length} purchased items cleared.`, async () => {
          await api(`/grocery-lists/${lid}/restore`, "POST", {
            ids: result.ids,
          });
          await refresh();
        });
    });
  const reset = async () => {
    if (
      await ui.confirm(
        "Uncheck every purchased item? Your items and order will stay the same.",
        "Uncheck all",
      )
    )
      run(async () => {
        await api(`/grocery-lists/${id}/reset`, "POST", {
          expected_revision: list.revision,
        });
        await refresh();
      });
  };
  const transfer = (copy) =>
    run(async () => {
      if (!destination) throw new Error("Choose a destination list.");
      await api(`/grocery-lists/${id}/transfer`, "POST", {
        ids: selected,
        target_list_id: Number(destination),
        copy,
        expected_revision: list.revision,
      });
      setSelected([]);
      await refresh();
      ui.notify(copy ? "Items copied." : "Items moved.");
    });
  const items = useMemo(() => {
    if (!list) return [];
    let value = list.items.filter(
      (i) =>
        (!prefs.hide || !i.completed) &&
        [i.name, i.notes, i.category]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    );
    if (prefs.group === "category")
      value = [...value].sort((a, b) =>
        (a.category || "Other").localeCompare(b.category || "Other"),
      );
    if (prefs.bottom)
      value = [
        ...value.filter((i) => !i.completed),
        ...value.filter((i) => i.completed),
      ];
    return value;
  }, [list, prefs, query]);
  const count = list?.items.filter((i) => i.completed).length || 0;
  return (
    <Box
      sx={{
        maxWidth: 820,
        mx: "auto",
      }}
    >
      {!id ? (
        <>
          <PageTitle
            title="Grocery lists"
            count={`${lists.length} ${lists.length === 1 ? "list" : "lists"}`}
          >
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => startName()}
            >
              New list
            </Button>
          </PageTitle>
          <ErrorText error={error} />
          <State
            loading={loading.lists}
            error={errors.lists}
            onRetry={() => refresh().catch(() => {})}
            empty={!lists.length}
            title="Your first grocery list"
            description="Add a list for your next shop."
            action={
              <Button onClick={() => startName()} startIcon={<AddRounded />}>
                Create list
              </Button>
            }
          />
          <SortableGroup items={lists} disabled={busy} onReorder={reorderLists}>
            <Stack spacing={1.5}>
              {lists.map((l, index) => {
                const done = l.items.filter((i) => i.completed).length;
                return (
                  <SortableRow
                    key={l.id}
                    id={l.id}
                    label={l.name}
                    disabled={busy}
                  >
                    {(handle) => (
                      <Paper
                        variant="outlined"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          p: 1.25,
                          gap: 0.5,
                          borderRadius: 3,
                        }}
                      >
                        {handle}
                        <Box
                          sx={{
                            bgcolor: colors[index % 4],
                            color: "text.secondary",
                            borderRadius: 2.5,
                            width: 48,
                            height: 54,
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                            mr: 1,
                          }}
                        >
                          <FoodIllustration kind={l.id % 6} size={48} />
                        </Box>
                        <ButtonBase
                          onClick={() => navigate(`/lists.html?list=${l.id}`)}
                          sx={{
                            display: "block",
                            textAlign: "left",
                            p: 1,
                            flex: 1,
                            minWidth: 0,
                            borderRadius: 2,
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 650,
                              fontSize: "1.05rem",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {l.name}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "text.secondary",
                              mt: 0.5,
                              mb: 1.25,
                            }}
                          >
                            {l.items.length - done} remaining{" "}
                            <Box
                              component="span"
                              sx={{
                                mx: 0.75,
                                opacity: 0.5,
                              }}
                            >
                              ·
                            </Box>
                            {done} purchased
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={
                              l.items.length ? (done / l.items.length) * 100 : 0
                            }
                            sx={{
                              maxWidth: 260,
                              height: 4,
                            }}
                          />
                        </ButtonBase>
                        <Overflow
                          label={`Actions for ${l.name}`}
                          disabled={busy}
                          items={[
                            {
                              label: "Rename",
                              icon: (
                                <EditOutlined
                                  sx={{
                                    fontSize: "small",
                                  }}
                                />
                              ),
                              action: () => startName(l),
                            },
                            {
                              label: "Duplicate",
                              icon: (
                                <ContentCopyOutlined
                                  sx={{
                                    fontSize: "small",
                                  }}
                                />
                              ),
                              action: () => duplicate(l),
                            },
                            {
                              label: "Move up",
                              disabled: index === 0,
                              icon: (
                                <ArrowUpwardRounded
                                  sx={{
                                    fontSize: "small",
                                  }}
                                />
                              ),
                              action: () => moveList(index, -1),
                            },
                            {
                              label: "Move down",
                              disabled: index === lists.length - 1,
                              icon: (
                                <ArrowDownwardRounded
                                  sx={{
                                    fontSize: "small",
                                  }}
                                />
                              ),
                              action: () => moveList(index, 1),
                            },
                            {
                              label: "Delete list",
                              danger: true,
                              icon: (
                                <DeleteOutlineRounded
                                  sx={{
                                    fontSize: "small",
                                  }}
                                />
                              ),
                              action: () => removeList(l),
                            },
                          ]}
                        />
                      </Paper>
                    )}
                  </SortableRow>
                );
              })}
            </Stack>
          </SortableGroup>
        </>
      ) : loading.lists ? (
        <State loading />
      ) : !list ? (
        <State
          error="This list is unavailable."
          onRetry={() => refresh().catch(() => {})}
        />
      ) : (
        <>
          <Button
            startIcon={<ArrowBackRounded />}
            onClick={() => navigate("/lists.html")}
            sx={{
              ml: -1.5,
              mb: 2,
            }}
            color="inherit"
          >
            Lists
          </Button>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "start",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Box
              sx={{
                minWidth: 0,
                flex: 1,
              }}
            >
              {renaming ? (
                <Box
                  component="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!title.trim()) {
                      setError("Enter a list name.");
                      return;
                    }
                    run(async () => {
                      await api(`/grocery-lists/${id}`, "PATCH", {
                        name: title.trim(),
                      });
                      setRenaming(false);
                      await refresh();
                    });
                  }}
                  sx={{
                    display: "flex",
                    gap: 0.5,
                    alignItems: "center",
                  }}
                >
                  <TextField
                    autoFocus
                    value={title}
                    label="List name"
                    onChange={(e) => setTitle(e.target.value)}
                    fullWidth
                  />
                  <IconButton
                    type="submit"
                    aria-label="Save list name"
                    disabled={busy}
                  >
                    <CheckRounded />
                  </IconButton>
                  <IconButton
                    aria-label="Cancel rename"
                    onClick={() => setRenaming(false)}
                  >
                    <CloseRounded />
                  </IconButton>
                </Box>
              ) : (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignItems: "center",
                  }}
                >
                  <Typography
                    variant="h1"
                    sx={{
                      fontSize: {
                        xs: "1.6rem",
                        sm: "1.9rem",
                      },
                      minWidth: 0,
                    }}
                  >
                    {list.name}
                  </Typography>
                  <IconButton
                    aria-label="Rename list"
                    onClick={() => {
                      setTitle(list.name);
                      setRenaming(true);
                    }}
                    size="small"
                  >
                    <EditOutlined
                      sx={{
                        fontSize: 18,
                      }}
                    />
                  </IconButton>
                </Stack>
              )}
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mt: 0.75,
                }}
              >
                {list.items.length - count} remaining · {count} purchased
              </Typography>
            </Box>
            <Tooltip title="Share list">
              <IconButton
                aria-label="Share list"
                onClick={() => setExporting(true)}
              >
                <IosShareRounded
                  sx={{
                    fontSize: "small",
                  }}
                />
              </IconButton>
            </Tooltip>
            <Overflow
              disabled={busy}
              items={[
                {
                  label: "Duplicate list",
                  action: () => duplicate(list),
                  icon: (
                    <ContentCopyOutlined
                      sx={{
                        fontSize: "small",
                      }}
                    />
                  ),
                },
                {
                  label: "Uncheck all",
                  action: reset,
                  disabled: !count,
                },
                {
                  label: "Clear purchased",
                  action: clearCompleted,
                  disabled: !count,
                },
                {
                  label: "Refresh",
                  icon: (
                    <RefreshRounded
                      sx={{
                        fontSize: "small",
                      }}
                    />
                  ),
                  action: () =>
                    run(async () => {
                      const loaded = await reload("lists");
                      if (editing) {
                        const latest = loaded
                          .find((l) => l.id === id)
                          ?.items.find((i) => i.id === editing.id);
                        if (latest)
                          setEditing({
                            ...editing,
                            version: latest.version,
                          });
                      }
                      ui.notify(
                        "List refreshed. Review unsaved changes before saving.",
                      );
                    }),
                },
                {
                  label: "Delete list",
                  danger: true,
                  action: () => removeList(list),
                  icon: (
                    <DeleteOutlineRounded
                      sx={{
                        fontSize: "small",
                      }}
                    />
                  ),
                },
              ]}
            />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={list.items.length ? (count / list.items.length) * 100 : 0}
            sx={{
              mb: 2.5,
              bgcolor: "#EFE9F8",
            }}
          />
          <ErrorText error={error} />
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <Box
              component="form"
              onSubmit={add}
              sx={{
                p: 1.5,
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: "#FDF5F7",
              }}
            >
              <TextField
                fullWidth
                inputRef={input}
                label="Add an item"
                placeholder="Milk, eggs…"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  saveDraft(`fw_list_draft_${id}`, e.target.value);
                }}
                multiline
                minRows={1}
                maxRows={5}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    add(e);
                  }
                }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          type="submit"
                          color="primary"
                          aria-label="Add items"
                          disabled={busy || !text.trim()}
                        >
                          <AddRounded />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                  htmlInput: {
                    enterKeyHint: "done",
                    "data-testid": "quick-add",
                  },
                }}
              />
            </Box>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                px: 1.5,
                py: 1,
                borderBottom: 1,
                borderColor: "divider",
                gap: 1,
              }}
            >
              <Button
                size="small"
                startIcon={<LocalMallOutlined />}
                color={prefs.shopping ? "primary" : "inherit"}
                variant={prefs.shopping ? "contained" : "text"}
                onClick={() =>
                  updatePrefs({
                    shopping: !prefs.shopping,
                  })
                }
              >
                Shopping
              </Button>
              <Stack direction="row">
                <Tooltip title="Find an item">
                  <IconButton
                    aria-label="Search items"
                    onClick={() => setShowSearch(!showSearch)}
                  >
                    <SearchRounded
                      sx={{
                        fontSize: "small",
                      }}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title="List options">
                  <IconButton
                    aria-label="List options"
                    onClick={(e) => setOptionsAnchor(e.currentTarget)}
                  >
                    <TuneRounded
                      sx={{
                        fontSize: "small",
                      }}
                    />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            <Collapse in={showSearch}>
              <Box
                sx={{
                  px: 2,
                  pt: 2,
                  pb: 1,
                }}
              >
                <TextField
                  fullWidth
                  autoFocus
                  label="Find an item"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRounded
                            sx={{
                              fontSize: "small",
                            }}
                          />
                        </InputAdornment>
                      ),
                      endAdornment: query ? (
                        <IconButton
                          aria-label="Clear search"
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
              </Box>
            </Collapse>
            {selected.length > 0 && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: "#E7F1E9",
                }}
              >
                <Stack spacing={1}>
                  <Typography variant="body2">
                    {selected.length} selected
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel id="move-destination-label">
                      Move or copy to
                    </InputLabel>
                    <Select
                      labelId="move-destination-label"
                      label="Move or copy to"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                    >
                      {lists
                        .filter((l) => l.id !== id)
                        .map((l) => (
                          <MenuItem key={l.id} value={l.id}>
                            {l.name}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                  <Stack direction="row" spacing={1}>
                    <Button onClick={() => transfer(false)} disabled={busy}>
                      Move
                    </Button>
                    <Button onClick={() => transfer(true)} disabled={busy}>
                      Copy
                    </Button>
                    <Button onClick={() => setSelected([])}>Cancel</Button>
                  </Stack>
                </Stack>
              </Box>
            )}
            <SortableGroup
              items={list.items}
              disabled={!canReorder}
              onReorder={reorderItems}
            >
              {items.map((item, index) => {
                const position = list.items.findIndex((i) => i.id === item.id);
                const heading =
                  prefs.group === "category" &&
                  (index === 0 || items[index - 1].category !== item.category);
                return (
                  <React.Fragment key={item.id}>
                    {heading && (
                      <Typography
                        variant="overline"
                        component="div"
                        sx={{
                          px: 2,
                          pt: 2,
                          pb: 0.5,
                          bgcolor: "#FCFAFD",
                          letterSpacing: ".07em",
                          color: "text.secondary",
                        }}
                      >
                        {item.category || "Other"}
                      </Typography>
                    )}
                    <GroceryItem
                      item={item}
                      last={index === items.length - 1}
                      position={position}
                      length={list.items.length}
                      prefs={prefs}
                      busy={busy}
                      canReorder={canReorder}
                      editing={editing}
                      setEditing={setEditing}
                      selected={selected}
                      setSelected={setSelected}
                      beginEdit={beginEdit}
                      saveItem={saveItem}
                      toggle={toggle}
                      remove={remove}
                      moveItem={moveItem}
                    />
                  </React.Fragment>
                );
              })}
            </SortableGroup>
            {!items.length && (
              <Box
                sx={{
                  p: 4,
                  textAlign: "center",
                }}
              >
                <Typography
                  sx={{
                    color: "text.secondary",
                  }}
                >
                  {query
                    ? "No matching items"
                    : prefs.hide && list.items.length
                      ? "Everything’s purchased"
                      : "No items yet"}
                </Typography>
              </Box>
            )}
          </Paper>
          <Popover
            open={!!optionsAnchor}
            anchorEl={optionsAnchor}
            onClose={() => setOptionsAnchor(null)}
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
          >
            <Stack
              sx={{
                p: 2.5,
                width: 280,
              }}
              spacing={1}
            >
              <Typography variant="h3">List options</Typography>
              <FormControlLabel
                label="Hide purchased"
                control={
                  <Switch
                    checked={prefs.hide}
                    onChange={(e) =>
                      updatePrefs({
                        hide: e.target.checked,
                      })
                    }
                  />
                }
              />
              <FormControlLabel
                label="Purchased at bottom"
                control={
                  <Switch
                    checked={prefs.bottom}
                    onChange={(e) =>
                      updatePrefs({
                        bottom: e.target.checked,
                      })
                    }
                  />
                }
              />
              <FormControl fullWidth>
                <InputLabel id="group-label">Arrange view</InputLabel>
                <Select
                  labelId="group-label"
                  label="Arrange view"
                  value={prefs.group}
                  onChange={(e) =>
                    updatePrefs({
                      group: e.target.value,
                    })
                  }
                >
                  <MenuItem value="manual">Manual order</MenuItem>
                  <MenuItem value="category">Category</MenuItem>
                </Select>
              </FormControl>
              {!canReorder && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                  }}
                >
                  Reordering is available in the full manual view.
                </Typography>
              )}
            </Stack>
          </Popover>
          {exporting && (
            <ListExport list={list} onClose={() => setExporting(false)} />
          )}
        </>
      )}
      <Dialog
        open={!!dialog}
        onClose={() => !busy && setDialog(null)}
        aria-labelledby="list-name-title"
      >
        <Box component="form" onSubmit={saveName} noValidate>
          <DialogTitle id="list-name-title">
            {dialog?.id ? "Rename list" : "New grocery list"}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="List name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              sx={{
                mt: 1,
              }}
              slotProps={{
                htmlInput: {
                  maxLength: 500,
                },
              }}
            />
            <ErrorText error={error} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <ActionButton busy={busy} type="submit" variant="contained">
              {dialog?.id ? "Save name" : "Create list"}
            </ActionButton>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
