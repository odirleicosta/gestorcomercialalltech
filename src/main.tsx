import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const CACHE_RESET_PARAM = "__lovable_cache_reset";

const stripResetParam = () => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has(CACHE_RESET_PARAM)) return;

  url.searchParams.delete(CACHE_RESET_PARAM);
  window.history.replaceState({}, "", url);
};

const resetAppCache = async () => {
  if (typeof window === "undefined") return false;

  const isPreviewEnvironment =
    import.meta.env.DEV || window.location.hostname.includes("lovable.app");

  if (!isPreviewEnvironment) return false;

  let didReset = false;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      didReset = true;
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  }

  if ("caches" in window) {
    const cacheKeys = await window.caches.keys();
    if (cacheKeys.length > 0) {
      didReset = true;
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    }
  }

  return didReset;
};

const mountApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
  stripResetParam();
};

void resetAppCache()
  .then((didReset) => {
    if (typeof window !== "undefined" && didReset) {
      const url = new URL(window.location.href);

      if (!url.searchParams.has(CACHE_RESET_PARAM)) {
        url.searchParams.set(CACHE_RESET_PARAM, "1");
        window.location.replace(url.toString());
        return;
      }
    }

    mountApp();
  })
  .catch(() => {
    mountApp();
  });
