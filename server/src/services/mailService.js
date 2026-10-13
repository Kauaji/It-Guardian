import nodemailer from "nodemailer";
import { getMailConfig, isProductionLike } from "../config/environment.js";
import { logger } from "../lib/logger.js";

/**
 * @typedef {object} MailMessage
 * @property {string} to
 * @property {string} subject
 * @property {string} text
 * @property {string} html
 */

/** @typedef {"smtp" | "outbox" | "dev-log" | "disabled"} MailMode */

const OUTBOX_LIMIT = 100;
/** @type {MailMessage[]} */
const testOutbox = [];

/** @type {{ key: string, transporter: import("nodemailer").Transporter } | null} */
let cachedTransport = null;

/**
 * - `smtp`: `SMTP_HOST` + `MAIL_FROM` configurados (producao e dev).
 * - `outbox`: so em `NODE_ENV=test`, guarda as mensagens em memoria para os testes.
 * - `dev-log`: so fora de producao e com `MAIL_DEV_LOG=true`; imprime a mensagem (com o link) no console.
 * - `disabled`: qualquer outro caso. Em producao o link NUNCA e escrito em log.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {MailMode}
 */
export function getMailMode(env = process.env) {
  const config = getMailConfig(env);
  if (config.host && config.from) return "smtp";
  if (config.testRuntime) return "outbox";
  if (config.devLog && !isProductionLike) return "dev-log";
  return "disabled";
}

/** @returns {boolean} Existe um canal de e-mail utilizavel? */
export function isMailEnabled() {
  return getMailMode() !== "disabled";
}

function smtpTransporter() {
  const config = getMailConfig();
  const key = JSON.stringify([config.host, config.port, config.secure, config.user, config.password]);
  if (cachedTransport?.key === key) return cachedTransport.transporter;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    // Funcao serverless (Vercel) tem tempo curto: falhar rapido e melhor que pendurar o pedido.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    requireTLS: !config.secure && config.port !== 25
  });
  cachedTransport = { key, transporter };
  return transporter;
}

/**
 * Envia um e-mail pelo canal configurado. Lanca erro se o envio falhar ou se nao houver canal.
 * @param {MailMessage} message
 * @returns {Promise<void>}
 */
export async function sendMail(message) {
  const mode = getMailMode();
  if (mode === "smtp") {
    await smtpTransporter().sendMail({ from: getMailConfig().from, ...message });
    return;
  }
  if (mode === "outbox") {
    testOutbox.push({ ...message });
    if (testOutbox.length > OUTBOX_LIMIT) testOutbox.shift();
    return;
  }
  if (mode === "dev-log") {
    process.stdout.write(`\n--- E-MAIL (MAIL_DEV_LOG) para ${message.to} ---\n${message.subject}\n\n${message.text}\n---\n`);
    return;
  }
  logger.warn("mail_disabled", { message: "Tentativa de enviar e-mail sem canal configurado (SMTP_HOST/MAIL_FROM)." });
  throw new Error("Envio de e-mail não configurado.");
}

/** Somente testes: mensagens capturadas no modo `outbox`. */
export function readTestOutbox() {
  return testOutbox.slice();
}

/** Somente testes: esvazia a caixa de saida simulada. */
export function clearTestOutbox() {
  testOutbox.length = 0;
}
