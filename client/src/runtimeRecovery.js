const RECOVERY_KEY = "itguardian:asset-recovery";
const RECOVERY_WINDOW_MS = 30_000;

export function isDynamicImportFailure(error) {
  const message = String(error?.message || error || "");
  return /dynamically imported module|failed to fetch.*module|importing a module script|loading chunk|chunkloaderror/i.test(
    message
  );
}

export function shouldAttemptAssetRecovery(previousAttempt, now = Date.now()) {
  const timestamp = Number(previousAttempt);
  return !Number.isFinite(timestamp) || now - timestamp > RECOVERY_WINDOW_MS;
}

function buildRecoveryUrl(locationLike) {
  const url = new URL(locationLike.href);
  url.searchParams.set("__itguardian_reload", String(Date.now()));
  return url.toString();
}

function renderRecoveryFallback(documentLike, error) {
  const root = documentLike.getElementById("root");
  if (!root || root.childElementCount > 0) return;

  const container = documentLike.createElement("main");
  container.className = "app-runtime-fallback";
  container.setAttribute("role", "alert");

  const title = documentLike.createElement("h1");
  title.textContent = "Não foi possível abrir o IT Guardian";

  const message = documentLike.createElement("p");
  message.textContent = isDynamicImportFailure(error)
    ? "Uma atualização do sistema foi detectada. Recarregue a página para continuar."
    : "Ocorreu uma falha inesperada. Seus dados não foram alterados.";

  const button = documentLike.createElement("button");
  button.type = "button";
  button.textContent = "Recarregar";
  button.addEventListener("click", () => window.location.reload());

  container.append(title, message, button);
  root.replaceChildren(container);
}

export function recoverFromAssetFailure(
  error,
  {
    storage = window.sessionStorage,
    locationLike = window.location,
    documentLike = document,
    now = Date.now()
  } = {}
) {
  if (!isDynamicImportFailure(error)) {
    renderRecoveryFallback(documentLike, error);
    return false;
  }

  const previousAttempt = storage.getItem(RECOVERY_KEY);
  if (shouldAttemptAssetRecovery(previousAttempt, now)) {
    storage.setItem(RECOVERY_KEY, String(now));
    locationLike.replace(buildRecoveryUrl(locationLike));
    return true;
  }

  renderRecoveryFallback(documentLike, error);
  return false;
}

export function installRuntimeRecovery() {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    recoverFromAssetFailure(event.payload || event.error || event);
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isDynamicImportFailure(event.reason)) {
      event.preventDefault();
      recoverFromAssetFailure(event.reason);
    }
  });

  window.addEventListener("error", (event) => {
    if (isDynamicImportFailure(event.error || event.message)) {
      recoverFromAssetFailure(event.error || event.message);
    }
  });
}

export function markApplicationReady() {
  window.setTimeout(() => {
    window.sessionStorage.removeItem(RECOVERY_KEY);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("__itguardian_reload")) return;
    url.searchParams.delete("__itguardian_reload");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, RECOVERY_WINDOW_MS);
}
