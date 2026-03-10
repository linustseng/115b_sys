import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        window.__swRegistration = registration;

        const notifyUpdate = () => {
          try {
            window.dispatchEvent(new Event("sw:update"));
          } catch {
            // ignore
          }
        };

        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdate();
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdate();
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          // When the new SW takes control, reload to pick up fresh assets.
          window.location.reload();
        });
      })
      .catch(() => {
        // Ignore registration errors to avoid blocking app load.
      });
  });
}
