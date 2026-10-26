import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import IosShareRounded from "@mui/icons-material/IosShareRounded";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { formatList } from "../lib/listExport";
export default function ListExport({ list, onClose }) {
  const [options, setOptions] = useState({
      completed: false,
      quantities: true,
      categories: false,
      notes: false,
    }),
    [status, setStatus] = useState("");
  const preview = useRef(null);
  const text = useMemo(() => formatList(list, options), [list, options]);
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(text);
      setStatus("Copied. Ready to paste into your notes.");
    } catch {
      preview.current?.focus();
      preview.current?.select();
      setStatus(
        "Copy is unavailable here. Select the text to copy it, or download the list.",
      );
    }
  };
  const share = async () => {
    if (!navigator.share) {
      setStatus(
        "Sharing is unavailable in this browser. You can copy or download the list.",
      );
      return;
    }
    try {
      await navigator.share({
        title: list.name,
        text,
      });
      setStatus("Shared.");
    } catch (e) {
      if (e.name !== "AbortError")
        setStatus("Unable to share. Try copying or downloading the list.");
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([text], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      (list.name.replace(/[^\p{L}\p{N}_-]/gu, "_") || "groceries") + ".txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Dialog open onClose={onClose} aria-labelledby="export-title">
      <DialogTitle
        id="export-title"
        sx={{
          pr: 7,
        }}
      >
        Share list
        <IconButton
          aria-label="Close export"
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 14,
            top: 14,
          }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2,
          }}
        >
          Plain text for Notes, Keep, or any notes app.
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            mb: 2,
          }}
        >
          {[
            ["completed", "Purchased items"],
            ["quantities", "Quantities"],
            ["categories", "Categories"],
            ["notes", "Notes"],
          ].map(([key, label]) => (
            <FormControlLabel
              key={key}
              label={label}
              control={
                <Checkbox
                  checked={options[key]}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      [key]: e.target.checked,
                    })
                  }
                />
              }
            />
          ))}
        </Box>
        <TextField
          fullWidth
          inputRef={preview}
          label="List preview"
          value={text}
          multiline
          minRows={7}
          maxRows={12}
          slotProps={{
            input: {
              readOnly: true,
            },
            htmlInput: {
              style: {
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
              },
            },
          }}
        />
        {status && (
          <Alert
            severity="info"
            sx={{
              mt: 2,
            }}
          >
            {status}
          </Alert>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Stack direction="row">
          <Tooltip title="Download text file">
            <IconButton aria-label="Download text" onClick={download}>
              <FileDownloadOutlined />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print">
            <IconButton
              aria-label="Print list"
              onClick={() => {
                document.getElementById("print-sheet").textContent = text;
                window.print();
              }}
            >
              <PrintOutlined />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<IosShareRounded />} onClick={share}>
            Share
          </Button>
          <Button
            startIcon={<ContentCopyRounded />}
            variant="contained"
            onClick={copy}
          >
            Copy text
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
