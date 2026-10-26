import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Typography,
  Skeleton,
  Paper,
} from "@mui/material";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);
export function UIProvider({ children }) {
  const [notice, setNotice] = useState(null),
    [question, setQuestion] = useState(null),
    [dirty, setDirty] = useState(false);
  const answer = useRef(null);
  const notify = useCallback(
    (message, action, actionLabel = "Undo", severity = "success") =>
      setNotice({
        message,
        action,
        actionLabel,
        severity,
        key: Date.now(),
      }),
    [],
  );
  const confirm = useCallback(
    (message, verb = "Delete") =>
      new Promise((resolve) => {
        answer.current = resolve;
        setQuestion({
          message,
          verb,
        });
      }),
    [],
  );
  const finish = (value) => {
    setQuestion(null);
    answer.current?.(value);
    answer.current = null;
  };
  return (
    <UIContext.Provider
      value={{
        notify,
        confirm,
        dirty,
        setDirty,
      }}
    >
      {children}
      <Snackbar
        key={notice?.key}
        open={!!notice}
        onClose={(_, reason) => {
          if (reason !== "clickaway") setNotice(null);
        }}
        autoHideDuration={notice?.action ? null : 5500}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        sx={{
          bottom: {
            xs: "calc(76px + env(safe-area-inset-bottom))!important",
            md: "24px!important",
          },
        }}
      >
        <Alert
          severity={notice?.severity || "success"}
          variant="filled"
          sx={{
            alignItems: "center",
            boxShadow: "0 6px 30px #0002",
          }}
          action={
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
              }}
            >
              {notice?.action && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={async () => {
                    const n = notice;
                    setNotice(null);
                    try {
                      await n.action();
                    } catch (e) {
                      notify(e.message, null, "", "error");
                    }
                  }}
                >
                  {notice.actionLabel}
                </Button>
              )}
              <IconButton
                color="inherit"
                size="small"
                aria-label="Dismiss message"
                onClick={() => setNotice(null)}
              >
                <CloseRounded
                  sx={{
                    fontSize: "small",
                  }}
                />
              </IconButton>
            </Stack>
          }
        >
          {notice?.message}
        </Alert>
      </Snackbar>
      <Dialog
        open={!!question}
        onClose={() => finish(false)}
        aria-labelledby="confirm-title"
      >
        <DialogTitle id="confirm-title">{question?.verb}?</DialogTitle>
        <DialogContent>
          <DialogContentText>{question?.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => finish(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={question?.verb === "Delete" ? "error" : "primary"}
            onClick={() => finish(true)}
          >
            {question?.verb}
          </Button>
        </DialogActions>
      </Dialog>
    </UIContext.Provider>
  );
}
export function ActionButton({ busy, children, ...props }) {
  return (
    <Button
      {...props}
      disabled={busy || props.disabled}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <CircularProgress
          size={18}
          color="inherit"
          sx={{
            position: "absolute",
          }}
        />
      ) : null}
      <span
        style={{
          visibility: busy ? "hidden" : "visible",
        }}
      >
        {children}
      </span>
    </Button>
  );
}
export function Overflow({ label = "More actions", items, disabled = false }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(e.currentTarget)}
        disabled={disabled}
      >
        <MoreHorizRounded />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {items.filter(Boolean).map((item, index) => (
          <MenuItem
            key={item.label || index}
            disabled={item.disabled}
            onClick={() => {
              setAnchor(null);
              item.action();
            }}
            sx={
              item.danger
                ? {
                    color: "error.main",
                  }
                : {}
            }
          >
            {item.icon}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
export function PageTitle({ title, count, children }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        alignItems: "center",
        justifyContent: "space-between",
        mb: 3,
      }}
    >
      <Box
        sx={{
          minWidth: 0,
        }}
      >
        <Typography variant="h1">{title}</Typography>
        {count != null && (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mt: 0.5,
            }}
          >
            {count}
          </Typography>
        )}
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
        }}
      >
        {children}
      </Stack>
    </Stack>
  );
}
export function State({
  loading,
  error,
  onRetry,
  empty,
  title,
  description,
  action,
}) {
  if (loading)
    return (
      <Stack spacing={2} aria-label="Loading">
        <Skeleton variant="rounded" height={90} />
        <Skeleton variant="rounded" height={90} />
        <Skeleton variant="rounded" height={90} />
      </Stack>
    );
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  if (empty)
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 5,
          textAlign: "center",
          borderStyle: "dashed",
        }}
      >
        <Typography variant="h2">{title}</Typography>
        {description && (
          <Typography
            sx={{
              color: "text.secondary",
              mt: 1,
              mb: 2,
            }}
          >
            {description}
          </Typography>
        )}
        {action}
      </Paper>
    );
  return null;
}
export function ErrorText({ error }) {
  return error ? (
    <Alert
      severity="error"
      sx={{
        my: 2,
      }}
    >
      {error}
    </Alert>
  ) : null;
}
