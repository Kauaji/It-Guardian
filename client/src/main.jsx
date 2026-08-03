import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AppErrorBoundary from "./components/ui/AppErrorBoundary.jsx";
import { installRuntimeRecovery, markApplicationReady } from "./runtimeRecovery.js";
import "./styles.css";

installRuntimeRecovery();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

markApplicationReady();
