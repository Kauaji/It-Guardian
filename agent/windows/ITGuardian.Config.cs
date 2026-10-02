using System;
using System.IO;
using System.Web.Script.Serialization;

namespace ITGuardian.Windows
{
    internal sealed class AgentConfig
    {
        public string serverUrl { get; set; }
        public string supportUrl { get; set; }
        public string agentToken { get; set; }
        public int intervalSeconds { get; set; }
        public string machineId { get; set; }
        public string machineAlias { get; set; }
        public string environment { get; set; }
        public string group { get; set; }
        public string segment { get; set; }
        public bool includeLoggedUser { get; set; }
        public bool enableRemoteScriptExecution { get; set; }
        public bool enableRemoteAssistance { get; set; }
        // Opcional: caminho completo do rustdesk.exe quando nao instalado num
        // dos locais padrao (ver RustdeskController.ResolveExecutablePath).
        public string rustdeskExecutablePath { get; set; }
        // Relay proprio do IT Guardian (ver RustdeskController.EnsureServerConfigured).
        // Vazios = cliente RustDesk continua no relay publico de fabrica.
        public string rustdeskIdServer { get; set; }
        public string rustdeskRelayServer { get; set; }
        public string rustdeskKey { get; set; }

        // --- Confianca (assinatura) -----------------------------------------
        // Chaves PUBLICAS ECDSA P-256 (base64 de SubjectPublicKeyInfo DER).
        // Ausentes = comportamento SEGURO: atualizacao automatica ignorada e
        // jobs de script recusados (ver ITGuardian.Policy.cs).
        // releasePublicKey: assina o manifesto de atualizacao; a privada fica
        // FORA do servidor da API. jobSigningPublicKey: assina cada job.
        public string releasePublicKey { get; set; }
        public string jobSigningPublicKey { get; set; }
        // Opt-out explicito e ruidoso (aviso a cada uso). So vale quando a
        // chave correspondente NAO esta configurada; com chave, assinatura
        // continua obrigatoria.
        public bool allowUnsignedUpdates { get; set; }
        public bool allowUnsignedJobs { get; set; }
    }

    internal static class AgentConfigReader
    {
        /// <summary>Interpreta o config.json. Chaves ausentes ficam no valor padrao (nulo/false/0).</summary>
        internal static AgentConfig Parse(string json)
        {
            AgentConfig config = new JavaScriptSerializer().Deserialize<AgentConfig>(json);
            if (config == null || string.IsNullOrWhiteSpace(config.serverUrl))
            {
                throw new InvalidOperationException("serverUrl e obrigatorio.");
            }
            if (config.intervalSeconds == 0) config.intervalSeconds = 300;
            if (config.intervalSeconds < 30 || config.intervalSeconds > 86400)
            {
                throw new InvalidOperationException("intervalSeconds deve estar entre 30 e 86400.");
            }
            return config;
        }

        internal static AgentConfig Load(string path)
        {
            if (!File.Exists(path)) throw new InvalidOperationException("Configuracao do IT Guardian nao encontrada.");
            return Parse(File.ReadAllText(path));
        }
    }
}
