import { badRequest } from "../../lib/errors.js";

// Diferente de analyzeMaintenanceScriptContent (so estima risco, nunca
// bloqueia), esta lista e um bloqueio rigido: comandos claramente
// destrutivos ou de escalonamento/evasao nao podem ser salvos no
// catalogo, independente do risk_level informado. Cada entrada tem um
// motivo legivel para o erro nao ficar generico.
const dangerousContentPatterns = [
  { pattern: /\bformat\b/i, reason: "formatar unidade de disco (format)" },
  { pattern: /\bdiskpart\b/i, reason: "particionamento de disco (diskpart)" },
  { pattern: /\bcipher\s+\/w\b/i, reason: "apagamento seguro de disco (cipher /w)" },
  { pattern: /\bdel\s+\/s\s+\/q\s+c:/i, reason: "exclusao recursiva da unidade C: (del /s /q C:)" },
  { pattern: /\brd\s+\/s\s+\/q\s+c:/i, reason: "remocao recursiva da unidade C: (rd /s /q C:)" },
  { pattern: /\bnet\s+user\s+\S+\s+\S*\s*\/add\b/i, reason: "criacao de usuario (net user /add)" },
  { pattern: /\bnet\s+localgroup\s+administrators\s+\S+\s+\/add\b/i, reason: "adicao de usuario ao grupo administradores" },
  { pattern: /\breg\s+add\s+["']?hklm[^\r\n]*\\run\b/i, reason: "persistencia via chave de registro Run" },
  { pattern: /\bschtasks\s+\/create\b/i, reason: "criacao de tarefa agendada (schtasks /create)" },
  { pattern: /(?=[\s\S]*\binvoke-webrequest\b)(?=[\s\S]*\bstart-process\b)/i, reason: "download seguido de execucao (Invoke-WebRequest + Start-Process)" },
  { pattern: /\b(curl|wget)\b[^\r\n]*\.exe\b/i, reason: "download de executavel externo (curl/wget para .exe)" },
  { pattern: /\bcertutil\s+.*-urlcache\b/i, reason: "download disfarcado via certutil -urlcache" },
  { pattern: /\bvssadmin\s+delete\s+shadows\b/i, reason: "exclusao de copias de sombra (vssadmin delete shadows)" },
  { pattern: /\bbcdedit\b/i, reason: "alteracao de configuracao de boot (bcdedit)" },
  { pattern: /\b(takeown|icacls)\b[^\r\n]*\\windows\\system32\b/i, reason: "alteracao de permissoes em diretorio do sistema" },
  {
    pattern: /(?=[\s\S]*\b(taskkill|sc\s+stop)\b)(?=[\s\S]*\b(defender|msmpeng|avp|mcafee|symantec|avast|kaspersky|sophos)\b)/i,
    reason: "encerramento de processo/servico de antivirus"
  },
  { pattern: /\bset-mppreference\b/i, reason: "alteracao de preferencias do Windows Defender (Set-MpPreference)" },
  { pattern: /\bdisablerealtimemonitoring\b/i, reason: "desativacao de protecao em tempo real (DisableRealtimeMonitoring)" }
];

export function assertScriptContentIsSafe(content) {
  const text = String(content || "");
  for (const { pattern, reason } of dangerousContentPatterns) {
    if (pattern.test(text)) {
      throw badRequest(`Conteudo do script bloqueado: ${reason}. Scripts destrutivos ou de evasao nao podem ser cadastrados.`);
    }
  }
}
