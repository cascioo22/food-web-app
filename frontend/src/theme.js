import { createTheme } from "@mui/material/styles";
export const theme = createTheme({
  palette: {
    primary: { main: "#A24B66", dark: "#80374F", light: "#F9E4EB" },
    secondary: { main: "#57755E" },
    background: { default: "#FFFCF9", paper: "#FFFFFF" },
    text: { primary: "#433A46", secondary: "#756A76" },
    divider: "#EAE2E8",
    error: { main: "#B33730" },
    success: { main: "#3F7153" },
  },
  typography: {
    fontFamily:
      '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontFamily: "Quicksand, sans-serif",
      fontSize: "1.75rem",
      fontWeight: 700,
      lineHeight: 1.22,
      letterSpacing: "-.035em",
    },
    h2: {
      fontFamily: "Quicksand, sans-serif",
      fontSize: "1.2rem",
      fontWeight: 700,
      letterSpacing: "-.02em",
    },
    h3: { fontSize: "1rem", fontWeight: 700 },
    body1: { fontSize: ".9375rem", lineHeight: 1.55 },
    body2: { fontSize: ".8125rem", lineHeight: 1.5 },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
    caption: { fontSize: ".75rem" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiStack: { defaultProps: { useFlexGap: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 12,
          minHeight: 40,
          padding: "8px 16px",
          whiteSpace: "nowrap",
        },
        outlined: { borderColor: "#DDD2DD" },
        text: { padding: "8px 12px" },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { width: 40, height: 40, borderRadius: 12 } },
    },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12, background: "#FFFFFF", fontSize: ".9375rem" },
        notchedOutline: { borderColor: "#DDD2DD" },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiDialog: {
      defaultProps: { fullWidth: true, maxWidth: "sm" },
      styleOverrides: { paper: { borderRadius: 16, backgroundImage: "none" } },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: "1.2rem",
          fontWeight: 700,
          padding: "24px 24px 16px",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: { root: { padding: "16px 24px", gap: 8 } },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: "1px solid #EAE2E8",
          borderRadius: 12,
          boxShadow: "0 8px 32px #433A4618",
        },
        list: { padding: 6 },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: ".875rem", borderRadius: 7, minHeight: 40, gap: 10 },
      },
    },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiCheckbox: { styleOverrides: { root: { padding: 10 } } },
    MuiAccordion: {
      defaultProps: { disableGutters: true },
      styleOverrides: {
        root: {
          boxShadow: "none",
          border: "1px solid #EAE2E8",
          "&:before": { display: "none" },
          borderRadius: "12px!important",
          overflow: "hidden",
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 6, fontSize: ".75rem" } },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 2 } } },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 60,
          textTransform: "none",
          fontSize: ".875rem",
          fontWeight: 600,
          minWidth: 100,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: { color: "#797C74", minHeight: 64 },
        label: {
          fontSize: ".72rem",
          "&.Mui-selected": { fontSize: ".72rem", fontWeight: 700 },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 4, backgroundColor: "#F0EAF1" },
      },
    },
  },
});
