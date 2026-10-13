// Textos dos e-mails de conta. Dominio puro: recebe dados, devolve { subject, text, html }.
// Todo valor vindo de usuario (nome) e escapado antes de entrar no HTML.

/** @type {Record<string, string>} */
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** @param {unknown} value */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** @param {unknown} name */
function firstName(name) {
  const first = String(name || "")
    .trim()
    .split(/\s+/)[0];
  return first || "";
}

/** @param {string} bodyHtml */
function wrapHtml(bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2937;max-width:520px">${bodyHtml}<p style="color:#6b7280;font-size:13px;margin-top:24px">IT Guardian</p></div>`;
}

/**
 * @param {{ name?: string, link: string, ttlMinutes: number }} input
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildPasswordResetEmail({ name, link, ttlMinutes }) {
  const greeting = firstName(name) ? `Olá, ${firstName(name)}!` : "Olá!";
  const text = [
    greeting,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta no IT Guardian.",
    "Para escolher uma nova senha, abra o link abaixo:",
    "",
    link,
    "",
    `O link vale por ${ttlMinutes} minutos e só pode ser usado uma vez.`,
    "Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.",
    "",
    "IT Guardian"
  ].join("\n");
  const html = wrapHtml(
    `<p>${escapeHtml(greeting)}</p>` +
      "<p>Recebemos um pedido para redefinir a senha da sua conta no IT Guardian.</p>" +
      `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none">Escolher nova senha</a></p>` +
      `<p>O link vale por ${ttlMinutes} minutos e só pode ser usado uma vez.</p>` +
      "<p>Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.</p>"
  );
  return { subject: "Redefinição de senha do IT Guardian", text, html };
}

/**
 * Aviso de seguranca depois de trocar a senha (nunca inclui link).
 * @param {{ name?: string }} input
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildPasswordChangedEmail({ name }) {
  const greeting = firstName(name) ? `Olá, ${firstName(name)}!` : "Olá!";
  const text = [
    greeting,
    "",
    "A senha da sua conta no IT Guardian acabou de ser alterada e todos os dispositivos conectados foram desconectados.",
    "Se foi você, não precisa fazer nada.",
    "Se não foi você, peça a um administrador para bloquear a conta e redefinir o acesso imediatamente.",
    "",
    "IT Guardian"
  ].join("\n");
  const html = wrapHtml(
    `<p>${escapeHtml(greeting)}</p>` +
      "<p>A senha da sua conta no IT Guardian acabou de ser alterada e todos os dispositivos conectados foram desconectados.</p>" +
      "<p>Se foi você, não precisa fazer nada.</p>" +
      "<p><strong>Se não foi você</strong>, peça a um administrador para bloquear a conta e redefinir o acesso imediatamente.</p>"
  );
  return { subject: "Sua senha do IT Guardian foi alterada", text, html };
}
