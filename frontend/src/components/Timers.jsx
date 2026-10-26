import { useEffect, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import TimerOutlined from "@mui/icons-material/TimerOutlined";
import PauseRounded from "@mui/icons-material/PauseRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { readStored, writeStored } from "../lib/api";
import { remaining } from "../lib/foodMath";
import { useUI } from "../components/UI";
export default function Timers({ recipeId }) {
  const ui = useUI(),
    key = `fw_timers_${recipeId}`;
  const [timers, setTimers] = useState(() => {
      const saved = readStored(key, []);
      return Array.isArray(saved)
        ? saved.filter(
            (t) =>
              typeof t.id === "string" &&
              Number.isFinite(t.deadline) &&
              Number.isFinite(t.remaining),
          )
        : [];
    }),
    [now, setNow] = useState(Date.now),
    [adding, setAdding] = useState(false),
    [label, setLabel] = useState(""),
    [minutes, setMinutes] = useState("5"),
    [error, setError] = useState("");
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pageshow", tick);
    };
  }, []);
  useEffect(() => {
    writeStored(key, timers);
  }, [timers]);
  useEffect(() => {
    const due = timers.filter(
      (t) => !t.paused && !t.announced && remaining(t, now) === 0,
    );
    if (!due.length) return;
    due.forEach((t) => ui.notify(`${t.label} timer finished.`));
    setTimers((v) =>
      v.map((t) =>
        due.some((d) => d.id === t.id)
          ? {
              ...t,
              announced: true,
            }
          : t,
      ),
    );
  }, [now, timers]);
  function add(e) {
    e.preventDefault();
    const value = Number(minutes);
    if (!(value > 0 && value <= 1440)) {
      setError("Enter a duration between 0 and 1,440 minutes.");
      return;
    }
    setTimers((v) => [
      ...v,
      {
        id: crypto.randomUUID(),
        label: label.trim() || "Kitchen timer",
        deadline: Date.now() + value * 60000,
        remaining: value * 60000,
        paused: false,
        announced: false,
      },
    ]);
    setLabel("");
    setAdding(false);
    setError("");
  }
  function pause(t) {
    setTimers((v) =>
      v.map((timer) =>
        timer.id !== t.id
          ? timer
          : t.paused
            ? {
                ...t,
                paused: false,
                deadline: Date.now() + t.remaining,
                announced: false,
              }
            : {
                ...t,
                paused: true,
                remaining: remaining(t),
              },
      ),
    );
  }
  const format = (value) => {
    const seconds = Math.ceil(value / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 3,
        p: 2.5,
        borderRadius: 3,
        bgcolor: "#F9F6FD",
      }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
          }}
        >
          <TimerOutlined
            sx={{
              fontSize: 20,
              color: "text.secondary",
            }}
          />
          <Typography variant="h3">Timers</Typography>
          <Tooltip title="Timers keep time across refreshes. Browsers may not deliver background alerts.">
            <IconButton
              aria-label="Timer limitations"
              size="small"
              sx={{
                width: 28,
                height: 28,
              }}
            >
              <InfoOutlined
                sx={{
                  fontSize: 15,
                }}
              />
            </IconButton>
          </Tooltip>
        </Stack>
        <Button
          size="small"
          startIcon={<AddRounded />}
          onClick={() => setAdding(!adding)}
        >
          Add timer
        </Button>
      </Stack>
      {timers.map((t) => (
        <Stack
          key={t.id}
          data-testid="timer-row"
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            py: 1.5,
            borderTop: 1,
            borderColor: "divider",
            mt: 1,
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
              }}
            >
              {t.label}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
              }}
            >
              {t.paused
                ? "Paused"
                : remaining(t, now) === 0
                  ? "Finished"
                  : "Running"}
            </Typography>
          </Box>
          <Typography
            component="output"
            sx={{
              fontVariantNumeric: "tabular-nums",
              fontSize: "1.35rem",
              fontWeight: 600,
            }}
          >
            {format(remaining(t, now))}
          </Typography>
          <IconButton
            aria-label={`${t.paused ? "Resume" : "Pause"} ${t.label}`}
            disabled={remaining(t, now) === 0}
            onClick={() => pause(t)}
          >
            {t.paused ? (
              <PlayArrowRounded
                sx={{
                  fontSize: "small",
                }}
              />
            ) : (
              <PauseRounded
                sx={{
                  fontSize: "small",
                }}
              />
            )}
          </IconButton>
          <IconButton
            aria-label={`Cancel ${t.label}`}
            onClick={() =>
              setTimers((v) => v.filter((timer) => timer.id !== t.id))
            }
          >
            <CloseRounded
              sx={{
                fontSize: "small",
              }}
            />
          </IconButton>
        </Stack>
      ))}
      {adding && (
        <Box
          component="form"
          onSubmit={add}
          noValidate
          sx={{
            mt: 2,
          }}
        >
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="Timer label"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              sx={{
                flex: 1,
              }}
            />
            <TextField
              label="Minutes"
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              sx={{
                width: 110,
              }}
              slotProps={{
                htmlInput: {
                  min: 0.01,
                  max: 1440,
                  step: "any",
                },
              }}
            />
          </Stack>
          {error && (
            <Typography
              role="alert"
              variant="body2"
              sx={{
                color: "error",
                mt: 1,
              }}
            >
              {error}
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={1}
            sx={{
              mt: 1.5,
            }}
          >
            <Button type="submit" variant="contained" size="small">
              Start timer
            </Button>
            <Button size="small" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
