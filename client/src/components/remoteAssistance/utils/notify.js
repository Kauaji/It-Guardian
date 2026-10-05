// `notify` e opcional nos consumidores do botao de assistencia remota.
export function notifyResult(notify, message, type = "ok") {
  if (typeof notify === "function") notify(message, type);
}
