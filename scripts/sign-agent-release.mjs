// Assina o manifesto de atualizacao do agente (roda no CI de release ou numa maquina offline).
//
//   AGENT_RELEASE_PRIVATE_KEY="$(cat release.pem)" \
//     node scripts/sign-agent-release.mjs --version 1.5.0 --url https://.../ITGuardian.exe --sha256 <hex>
//
// Saida (stdout): {"version","sha256","url","signature"}. O operador publica estes valores nas variaveis
// AGENT_LATEST_VERSION / AGENT_LATEST_VERSION_URL / AGENT_LATEST_VERSION_SHA256 / AGENT_LATEST_VERSION_SIGNATURE.
import { buildUpdateMessage, derivePublicKeyBase64, signUpdateManifest, verifyMessage } from "../server/src/security/agentSigning.js";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

const version = option("version");
const url = option("url");
const sha256 = option("sha256").toLowerCase();
const privateKey = process.env.AGENT_RELEASE_PRIVATE_KEY;

if (!privateKey) {
  process.stderr.write("Defina AGENT_RELEASE_PRIVATE_KEY (PEM PKCS#8).\n");
  process.exit(2);
}
if (!version || !url || !/^[0-9a-f]{64}$/.test(sha256)) {
  process.stderr.write("Uso: --version <v> --url <https://...> --sha256 <64 hex>\n");
  process.exit(2);
}
if (!url.startsWith("https://")) {
  process.stderr.write("A URL de atualizacao precisa ser https.\n");
  process.exit(2);
}

const manifest = { version, sha256, url };
const signature = signUpdateManifest(privateKey, manifest);
// Autoconferencia: nunca emite uma assinatura que a propria chave publica derivada nao valide.
if (!verifyMessage(derivePublicKeyBase64(privateKey), buildUpdateMessage(manifest), signature)) {
  process.stderr.write("Autoconferencia da assinatura falhou.\n");
  process.exit(1);
}
process.stdout.write(`${JSON.stringify({ ...manifest, signature })}\n`);
