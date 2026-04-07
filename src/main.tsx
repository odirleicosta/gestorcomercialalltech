import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const CACHE_RESET_PARAM = "__lovable_cache_reset";
const FORCED_RELOAD_KEY = "__lovable_forced_reload_at";
const FORCED_RELOAD_COOLDOWN_MS = 15000;

const isLovableHosted = () =>
  typeof window !== "undefined" && window.location.hostname.includes("lovable.app");

const stripResetParam = () => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has(CACHE_RESET_PARAM)) return;

  url.searchParams.delete(CACHE_RESET_PARAM);
  window.history.replaceState({}, "", url);
};

const resetAppCache = async () => {
  if (typeof window === "undefined" || !isLovableHosted()) return;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
  }
};

const forceFreshLoadIfNeeded = () => {
  if (typeof window === "undefined" || !isLovableHosted()) return false;

  const url = new URL(window.location.href);
  if (url.searchParams.has(CACHE_RESET_PARAM)) return false;

  const now = Date.now();
  const lastForcedReload = Number(window.sessionStorage.getItem(FORCED_RELOAD_KEY) || "0");

  if (now - lastForcedReload < FORCED_RELOAD_COOLDOWN_MS) return false;

  window.sessionStorage.setItem(FORCED_RELOAD_KEY, String(now));
  url.searchParams.set(CACHE_RESET_PARAM, String(now));
  window.location.replace(url.toString());
  return true;
};

const mountApp = () => {
  createRoot(document.getElementById("root")!).render(<App />);
  stripResetParam();
};

const bootstrap = async () => {
  if (forceFreshLoadIfNeeded()) return;

  try {
    await resetAppCache();
  } finally {
    mountApp();
  }
};

void bootstrap();
