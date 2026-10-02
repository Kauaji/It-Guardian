// Gera um par de chaves ECDSA P-256 para assinatura do agente Windows.
//
//   npm run agent:keys -- release   # chave de RELEASE: guarde FORA do servidor (cofre/CI)
//   npm run agent:keys -- jobs      # chave de JOBS: vai para o servidor (AGENT_JOB_SIGNING_PRIVATE_KEY)
//
// A chave publica (base64) vai no instalador/config do agente; a privada nunca e impressa em log de CI.
import { generateSigningKeyPair } from "../server/src/security/agentSigning.js";

const role = process.argv[2];
if (!["release", "jobs"].includes(role)) {
  process.stderr.write("Uso: node scripts/agent-keys.mjs <release|jobs>\n");
  process.exit(2);
}

const { privateKeyPem, publicKeyBase64 } = generateSigningKeyPair();
const names =
  role === "release"
    ? { priv: "AGENT_RELEASE_PRIVATE_KEY", pub: "releasePublicKey (config do agente / installers/windows-collector/release-public-key.txt)" }
    : { priv: "AGENT_JOB_SIGNING_PRIVATE_KEY", pub: "jobSigningPublicKey (entregue ao agente na ativacao)" };

process.stdout.write(`# Chave publica -> ${names.pub}\n${publicKeyBase64}\n\n`);
process.stdout.write(`# Chave PRIVADA -> ${names.priv}  (segredo; nao versione, nao cole em chat/log)\n${privateKeyPem}`);
if (role === "release") {
  process.stdout.write("\n# Mantenha esta chave fora do servidor da API: e ela que impede que um servidor comprometido empurre um executavel malicioso.\n");
}
