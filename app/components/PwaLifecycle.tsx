"use client";

import { useEffect } from "react";

/**
 * Keeps the installable application current without placing status cards over
 * menu or game controls. Live rooms are never reloaded automatically.
 */
export default function PwaLifecycle() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let requestedActivation = false;
    const inLiveRoom = window.location.pathname.startsWith("/room/");
    const activate = (worker: ServiceWorker | null) => {
      if (!worker || inLiveRoom) return;
      requestedActivation = true;
      worker.postMessage({ type: "SKIP_WAITING" });
    };
    const reloadForUpdate = () => {
      if (requestedActivation) window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadForUpdate);
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      activate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) activate(worker);
        });
      });
    }).catch(() => undefined);

    return () => navigator.serviceWorker.removeEventListener("controllerchange", reloadForUpdate);
  }, []);

  return null;
}
