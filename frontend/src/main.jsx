import React from "react";
import { createRoot } from "react-dom/client";
import {
  ThemeProvider,
  CssBaseline,
  Alert,
  Button,
  Container,
} from "@mui/material";
import "@fontsource/quicksand/latin-600.css";
import "@fontsource/quicksand/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import { theme } from "./theme";
import { UIProvider } from "./components/UI";
import App from "./App";
import "./styles.css";
class ErrorBoundary extends React.Component {
  state = {
    error: null,
  };
  static getDerivedStateFromError(error) {
    return {
      error,
    };
  }
  render() {
    return this.state.error ? (
      <Container
        sx={{
          py: 6,
        }}
      >
        <Alert
          severity="error"
          action={<Button onClick={() => location.reload()}>Reload</Button>}
        >
          Pantry could not open this screen. Reload to try again.
        </Alert>
      </Container>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <ErrorBoundary>
      <UIProvider>
        <App />
      </UIProvider>
    </ErrorBoundary>
  </ThemeProvider>,
);
