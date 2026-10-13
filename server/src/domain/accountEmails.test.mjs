import assert from "node:assert/strict";
import test from "node:test";
import { buildPasswordChangedEmail, buildPasswordResetEmail, escapeHtml } from "./accountEmails.js";

test("escapeHtml neutraliza marcacao e aspas", () => {
  assert.equal(escapeHtml(`<script>alert("x")</script> & 'y'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
  assert.equal(escapeHtml(null), "");
});

test("o e-mail de redefinicao escapa o nome e o link no HTML e traz o prazo", () => {
  const email = buildPasswordResetEmail({
    name: `<img src=x onerror=alert(1)> Maria`,
    link: "https://app.empresa.test/redefinir-senha#token=abc&x=<b>",
    ttlMinutes: 45
  });
  assert.ok(!email.html.includes("<img"), "nome malicioso nao vira tag");
  assert.ok(!email.html.includes("<b>"), "link e escapado no atributo");
  assert.match(email.html, /&lt;img/);
  assert.match(email.text, /45 minutos/);
  assert.match(email.text, /https:\/\/app\.empresa\.test\/redefinir-senha#token=abc/);
  assert.match(email.subject, /^Redefinição de senha/);
});

test("o aviso de senha alterada nunca contem link e funciona sem nome", () => {
  const email = buildPasswordChangedEmail({});
  assert.ok(!/https?:\/\//.test(email.text) && !/href=/.test(email.html));
  assert.match(email.text, /^Olá!/);
  assert.match(email.text, /Se não foi você/);
});
