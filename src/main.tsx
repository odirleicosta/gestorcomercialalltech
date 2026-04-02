import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const resetAppCache = async () => {
  if (typeof window === "undefined") return;

  const isPreviewEnvironment =
    import.meta.env.DEV || window.location.hostname.includes("lovable.app");

  if (!isPreviewEnvironment) return;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
  }
};

void resetAppCache().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
