import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import AppErrorBoundary from "./components/ui/AppErrorBoundary.jsx";
import { installRuntimeRecovery, markApplicationReady } from "./runtimeRecovery.js";
// Fonte auto-hospedada (CSP: font-src 'self'); latin cobre portugues.
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./styles.css";

installRuntimeRecovery();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);

markApplicationReady();
