import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  lazy,
  Suspense,
} from "react";
import {
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Container,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from "@mui/material";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import ChecklistRounded from "@mui/icons-material/ChecklistRounded";
import PhotoLibraryOutlined from "@mui/icons-material/PhotoLibraryOutlined";
import { api } from "./lib/api";
import { useUI, State } from "./components/UI";
import FoodIllustration from "./components/FoodIllustration";
const Lists = lazy(() => import("./pages/Lists"));
const Recipes = lazy(() => import("./pages/Recipes"));
const Photos = lazy(() => import("./pages/Photos"));
const Cooking = lazy(() => import("./pages/Cooking"));
const DataContext = createContext(null);
export const useData = () => useContext(DataContext);
const parseRoute = () => ({
  page: location.pathname.endsWith("lists.html")
    ? "lists"
    : location.pathname.endsWith("photos.html")
      ? "photos"
      : location.pathname.endsWith("cooking.html")
        ? "cooking"
        : "recipes",
  params: new URLSearchParams(location.search),
});
const routes = [
  {
    value: "recipes",
    label: "Recipes",
    href: "/index.html",
    icon: <MenuBookOutlined />,
  },
  {
    value: "lists",
    label: "Lists",
    href: "/lists.html",
    icon: <ChecklistRounded />,
  },
  {
    value: "photos",
    label: "Photos",
    href: "/photos.html",
    icon: <PhotoLibraryOutlined />,
  },
];
export default function App() {
  const ui = useUI(),
    [route, setRoute] = useState(parseRoute),
    [recipes, setRecipes] = useState([]),
    [lists, setLists] = useState([]),
    [photos, setPhotos] = useState([]),
    [loading, setLoading] = useState({
      recipes: true,
      lists: true,
      photos: true,
    }),
    [errors, setErrors] = useState({});
  const currentHref = useRef(location.pathname + location.search);
  useEffect(() => {
    currentHref.current = location.pathname + location.search;
  }, [route]);
  const reload = useCallback(async (type) => {
    try {
      const data = await api(
        type === "recipes"
          ? "/recipes"
          : type === "lists"
            ? "/grocery-lists"
            : "/photos?limit=1000",
      );
      const value = type === "photos" ? data.photos : data;
      ({
        recipes: setRecipes,
        lists: setLists,
        photos: setPhotos,
      })[type](value);
      setErrors((e) => ({
        ...e,
        [type]: null,
      }));
      return value;
    } catch (e) {
      setErrors((v) => ({
        ...v,
        [type]: e.message,
      }));
      throw e;
    } finally {
      setLoading((v) => ({
        ...v,
        [type]: false,
      }));
    }
  }, []);
  useEffect(() => {
    for (const key of ["recipes", "lists", "photos"])
      reload(key).catch(() => {});
  }, [reload]);
  const navigate = async (href, { force = false } = {}) => {
    if (
      !force &&
      ui.dirty &&
      !(await ui.confirm("Discard your unsaved changes?", "Discard changes"))
    )
      return false;
    ui.setDirty(false);
    history.pushState({}, "", href);
    setRoute(parseRoute());
    window.scrollTo({
      top: 0,
    });
    return true;
  };
  useEffect(() => {
    const pop = async () => {
      if (ui.dirty) {
        const target = location.pathname + location.search;
        history.pushState({}, "", currentHref.current);
        if (
          !(await ui.confirm(
            "Discard your unsaved changes?",
            "Discard changes",
          ))
        )
          return;
        ui.setDirty(false);
        history.replaceState({}, "", target);
      }
      setRoute(parseRoute());
      window.scrollTo({
        top: 0,
      });
    };
    const unload = (e) => {
      if (ui.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("beforeunload", unload);
    };
  }, [ui.dirty]);
  useEffect(() => {
    document.title = `${route.page === "cooking" ? "Cooking" : route.page[0].toUpperCase() + route.page.slice(1)} · Pantry`;
  }, [route.page]);
  return (
    <DataContext.Provider
      value={{
        recipes,
        lists,
        photos,
        loading,
        errors,
        reload,
        setLists,
        setRecipes,
        route,
        navigate,
      }}
    >
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Container maxWidth="lg">
          <Toolbar
            disableGutters
            sx={{
              minHeight: "64px!important",
              justifyContent: "space-between",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              component="a"
              href="/index.html"
              onClick={(e) => {
                e.preventDefault();
                navigate("/index.html");
              }}
              sx={{
                alignItems: "center",
                color: "text.primary",
                textDecoration: "none",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 32,
                  height: 32,
                  bgcolor: "primary.light",
                  color: "primary.main",
                  borderRadius: 2,
                }}
              >
                <FoodIllustration kind={0} size={36} />
              </Box>
              <Typography
                sx={{
                  fontFamily: "Quicksand, sans-serif",
                  fontWeight: 700,
                  fontSize: "1.2rem",
                  letterSpacing: "-.04em",
                }}
              >
                Pantry
              </Typography>
            </Stack>
            <Tabs
              value={route.page === "cooking" ? false : route.page}
              onChange={(_, value) =>
                navigate(routes.find((r) => r.value === value).href)
              }
              sx={{
                display: {
                  xs: "none",
                  md: "flex",
                },
              }}
            >
              {routes.map((r) => (
                <Tab
                  key={r.value}
                  value={r.value}
                  label={r.label}
                  icon={r.icon}
                  iconPosition="start"
                />
              ))}
            </Tabs>
          </Toolbar>
        </Container>
      </AppBar>
      <Container
        component="main"
        maxWidth="lg"
        sx={{
          pt: {
            xs: 3,
            md: 4,
          },
          pb:
            route.page === "cooking"
              ? 5
              : "calc(96px + env(safe-area-inset-bottom))",
          px: {
            xs: 2,
            sm: 3,
          },
        }}
      >
        <Suspense fallback={<State loading />}>
          {route.page === "lists" ? (
            <Lists />
          ) : route.page === "photos" ? (
            <Photos />
          ) : route.page === "cooking" ? (
            <Cooking />
          ) : (
            <Recipes />
          )}
        </Suspense>
      </Container>
      {route.page !== "cooking" && (
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            pb: "env(safe-area-inset-bottom)",
            zIndex: 1000,
            display: {
              md: "none",
            },
          }}
        >
          <BottomNavigation
            showLabels
            value={route.page}
            onChange={(_, value) =>
              navigate(routes.find((r) => r.value === value).href)
            }
            sx={{
              height: 66,
              maxWidth: 500,
              mx: "auto",
            }}
          >
            {routes.map((r) => (
              <BottomNavigationAction
                key={r.value}
                value={r.value}
                label={r.label}
                icon={r.icon}
              />
            ))}
          </BottomNavigation>
        </Box>
      )}
    </DataContext.Provider>
  );
}
