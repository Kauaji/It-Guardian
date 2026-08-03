function enabled(value) {
  return ["1", "true", "yes", "sim"].includes(String(value || "").trim().toLowerCase());
}

export const remoteScriptExecutionEnabled = enabled(
  import.meta.env.VITE_ENABLE_REMOTE_SCRIPT_EXECUTION
);
