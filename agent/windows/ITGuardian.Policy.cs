using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace ITGuardian.Windows
{
    // Politica de confianca do agente: PURA (sem rede, sem registro do Windows),
    // para ser testada em qualquer plataforma. A integracao com HTTP, disco e
    // execucao fica em ITGuardian.Windows.cs; aqui so se decide "pode ou nao".
    //
    // Principios:
    //  - SEGURO POR PADRAO: sem chave publica configurada, atualizacao e job
    //    sao recusados, a menos que o config local diga explicitamente
    //    allowUnsignedUpdates / allowUnsignedJobs (opt-out ruidoso).
    //  - Com chave configurada a assinatura e SEMPRE obrigatoria; os flags
    //    allowUnsigned* nao a contornam.
    //  - Verifica a assinatura sobre dados reconstruidos localmente; nunca
    //    confia em mensagem pronta enviada pelo servidor.

    internal sealed class GateDecision
    {
        internal readonly bool Allowed;
        internal readonly string Reason;
        // Preenchido quando foi permitido SEM assinatura por opt-out; o chamador
        // deve registrar este aviso a cada uso.
        internal readonly string Warning;

        private GateDecision(bool allowed, string reason, string warning)
        {
            Allowed = allowed;
            Reason = reason;
            Warning = warning;
        }

        internal static GateDecision Allow(string reason) { return new GateDecision(true, reason, null); }
        internal static GateDecision AllowUnsigned(string reason, string warning) { return new GateDecision(true, reason, warning); }
        internal static GateDecision Refuse(string reason) { return new GateDecision(false, reason, null); }

        public override string ToString()
        {
            return (Allowed ? "PERMITIDO: " : "RECUSADO: ") + Reason;
        }
    }

    internal static class UnixTime
    {
        private static readonly DateTime Epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        // DateTimeOffset.ToUnixTimeSeconds so existe no .NET Framework 4.6+.
        internal static long FromUtc(DateTime utc)
        {
            return (long)Math.Floor((utc.ToUniversalTime() - Epoch).TotalSeconds);
        }

        internal static long Now()
        {
            return FromUtc(DateTime.UtcNow);
        }
    }

    internal static class VersionComparer
    {
        /// <summary>
        /// Mesma semantica do compareVersions do servidor (agentService.js):
        /// segmentos separados por ".", comparacao numerica por segmento,
        /// segmento sem digitos iniciais vale 0, segmentos ausentes valem 0
        /// ("1.6.4" == "1.6.4.0").
        /// </summary>
        internal static int Compare(string left, string right)
        {
            long[] a = LenientParts(left);
            long[] b = LenientParts(right);
            int length = Math.Max(a.Length, b.Length);
            for (int index = 0; index < length; index++)
            {
                long x = index < a.Length ? a[index] : 0;
                long y = index < b.Length ? b[index] : 0;
                if (x != y) return x < y ? -1 : 1;
            }
            return 0;
        }

        private static long[] LenientParts(string version)
        {
            string[] segments = (string.IsNullOrEmpty(version) ? "0" : version).Split('.');
            long[] parts = new long[segments.Length];
            for (int index = 0; index < segments.Length; index++)
            {
                long value = 0;
                string segment = segments[index];
                int digits = 0;
                while (digits < segment.Length && segment[digits] >= '0' && segment[digits] <= '9' && digits < 15)
                {
                    value = value * 10 + (segment[digits] - '0');
                    digits++;
                }
                parts[index] = value;
            }
            return parts;
        }

        /// <summary>Formato estrito aceito para a versao OFERECIDA: 1 a 4 segmentos numericos de ate 9 digitos.</summary>
        internal static bool IsStrictVersion(string version)
        {
            if (string.IsNullOrEmpty(version)) return false;
            string[] segments = version.Split('.');
            if (segments.Length > 4) return false;
            foreach (string segment in segments)
            {
                if (segment.Length == 0 || segment.Length > 9) return false;
                foreach (char c in segment)
                {
                    if (c < '0' || c > '9') return false;
                }
            }
            return true;
        }

        internal static bool IsStrictlyNewer(string offered, string current)
        {
            return Compare(offered, current) > 0;
        }
    }

    internal static class HexText
    {
        internal static bool IsSha256Hex(string value)
        {
            if (value == null || value.Length != 64) return false;
            foreach (char c in value)
            {
                bool digit = c >= '0' && c <= '9';
                bool lower = c >= 'a' && c <= 'f';
                bool upper = c >= 'A' && c <= 'F';
                if (!digit && !lower && !upper) return false;
            }
            return true;
        }
    }

    internal static class UpdateGate
    {
        /// <summary>
        /// Decide, ANTES de baixar qualquer byte, se a atualizacao oferecida pode ser aplicada.
        /// </summary>
        internal static GateDecision Evaluate(
            AgentConfig config,
            string currentVersion,
            string offeredVersion,
            string offeredUrl,
            string offeredSha256,
            string offeredSignature)
        {
            if (config == null) return GateDecision.Refuse("configuracao do agente ausente");

            string key = (config.releasePublicKey ?? "").Trim();
            bool hasKey = key.Length > 0;
            if (!hasKey && !config.allowUnsignedUpdates)
            {
                return GateDecision.Refuse(
                    "releasePublicKey nao configurada: atualizacao automatica ignorada " +
                    "(configure releasePublicKey no config.json; somente em laboratorio use allowUnsignedUpdates=true)");
            }

            if (string.IsNullOrWhiteSpace(offeredVersion) ||
                string.IsNullOrWhiteSpace(offeredUrl) ||
                string.IsNullOrWhiteSpace(offeredSha256))
            {
                return GateDecision.Refuse("oferta de atualizacao incompleta (versao, URL ou SHA-256 ausente)");
            }
            if (!VersionComparer.IsStrictVersion(offeredVersion))
            {
                return GateDecision.Refuse("versao oferecida em formato invalido: " + Printable(offeredVersion));
            }
            if (!VersionComparer.IsStrictlyNewer(offeredVersion, currentVersion))
            {
                return GateDecision.Refuse(
                    "versao oferecida (" + offeredVersion + ") nao e estritamente maior que a atual (" + currentVersion + ")");
            }
            Uri parsed;
            if (!Uri.TryCreate(offeredUrl, UriKind.Absolute, out parsed) || parsed.Scheme != Uri.UriSchemeHttps)
            {
                return GateDecision.Refuse("URL de atualizacao ausente, invalida ou nao HTTPS");
            }
            if (!HexText.IsSha256Hex(offeredSha256))
            {
                return GateDecision.Refuse("SHA-256 oferecido nao e hexadecimal de 64 caracteres");
            }

            if (!hasKey)
            {
                return GateDecision.AllowUnsigned(
                    "atualizacao aceita sem assinatura (allowUnsignedUpdates=true)",
                    "AVISO DE SEGURANCA: aplicando atualizacao SEM verificar assinatura porque allowUnsignedUpdates=true e " +
                    "releasePublicKey nao esta configurada. Quem controlar o servidor ou o TLS pode entregar um executavel arbitrario.");
            }

            if (string.IsNullOrWhiteSpace(offeredSignature))
            {
                return GateDecision.Refuse("manifesto de atualizacao sem assinatura (latestVersionSignature ausente)");
            }
            string message;
            try
            {
                message = UpdateMessage.Build(offeredVersion, offeredSha256, offeredUrl);
            }
            catch (ArgumentException invalidField)
            {
                return GateDecision.Refuse("campo invalido na oferta de atualizacao: " + invalidField.Message);
            }
            string error;
            if (!SignatureVerifier.TryVerifyText(key, message, offeredSignature, out error))
            {
                return GateDecision.Refuse("assinatura do manifesto de atualizacao recusada: " + error);
            }
            return GateDecision.Allow("manifesto de atualizacao assinado e valido");
        }

        private static string Printable(string value)
        {
            string text = value ?? "";
            if (text.Length > 40) text = text.Substring(0, 40) + "...";
            StringBuilder builder = new StringBuilder(text.Length);
            foreach (char c in text) builder.Append(c < ' ' ? '?' : c);
            return "\"" + builder + "\"";
        }
    }

    /// <summary>Job recebido do servidor, nos termos do protocolo de assinatura.</summary>
    internal sealed class SignedJob
    {
        internal string JobId;
        internal string AssetId;
        internal string Interpreter;
        internal long TimeoutSeconds;
        internal string Content;
        // Opcional: hash que o servidor afirma ser do conteudo. Quando vem, e conferido com o hash local.
        internal string ContentSha256;
        internal string Signature;
        internal long NotAfter;
    }

    internal static class JobGate
    {
        // Tolerancia de relogio entre servidor e maquina.
        internal const long ClockToleranceSeconds = 5 * 60;

        internal static GateDecision Evaluate(
            AgentConfig config,
            SignedJob job,
            string ownAssetId,
            long nowUnix,
            ICollection<string> seenIds)
        {
            if (config == null) return GateDecision.Refuse("configuracao do agente ausente");
            if (job == null) return GateDecision.Refuse("job ausente");

            string key = (config.jobSigningPublicKey ?? "").Trim();
            bool hasKey = key.Length > 0;
            if (!hasKey)
            {
                if (!config.allowUnsignedJobs)
                {
                    return GateDecision.Refuse(
                        "jobSigningPublicKey nao configurada: job recusado " +
                        "(configure jobSigningPublicKey no config.json; somente em laboratorio use allowUnsignedJobs=true)");
                }
                return GateDecision.AllowUnsigned(
                    "job aceito sem assinatura (allowUnsignedJobs=true)",
                    "AVISO DE SEGURANCA: executando job SEM verificar assinatura porque allowUnsignedJobs=true e " +
                    "jobSigningPublicKey nao esta configurada. Quem controlar o servidor ou o TLS executa scripts arbitrarios nesta maquina.");
            }

            if (string.IsNullOrWhiteSpace(job.Signature))
            {
                return GateDecision.Refuse("job sem assinatura");
            }
            if (string.IsNullOrWhiteSpace(job.JobId) || string.IsNullOrWhiteSpace(job.AssetId) ||
                string.IsNullOrWhiteSpace(job.Interpreter))
            {
                return GateDecision.Refuse("job sem jobId, assetId ou interpretador");
            }
            if (job.Content == null)
            {
                return GateDecision.Refuse("job sem conteudo de script");
            }
            if (job.NotAfter <= 0)
            {
                return GateDecision.Refuse("job sem validade (notAfter ausente)");
            }

            // O hash que entra na mensagem e SEMPRE o calculado aqui, sobre o conteudo recebido.
            string localContentSha256 = Hashing.Sha256HexOfText(job.Content);
            if (!string.IsNullOrWhiteSpace(job.ContentSha256) &&
                !string.Equals(job.ContentSha256.Trim(), localContentSha256, StringComparison.OrdinalIgnoreCase))
            {
                return GateDecision.Refuse("contentSha256 informado nao confere com o SHA-256 local do conteudo recebido");
            }

            string message;
            try
            {
                message = JobMessage.Build(
                    job.JobId, job.AssetId, job.Interpreter, job.TimeoutSeconds, localContentSha256, job.NotAfter);
            }
            catch (ArgumentException invalidField)
            {
                return GateDecision.Refuse("campo invalido no job: " + invalidField.Message);
            }
            string error;
            if (!SignatureVerifier.TryVerifyText(key, message, job.Signature, out error))
            {
                return GateDecision.Refuse("assinatura do job recusada (campos ou conteudo diferem do que foi assinado): " + error);
            }

            // A partir daqui os campos sao autenticos; falta checar se valem para ESTA maquina e AGORA.
            string own = (ownAssetId ?? "").Trim();
            if (own.Length == 0)
            {
                return GateDecision.Refuse("identificador proprio da maquina desconhecido; job recusado");
            }
            if (!string.Equals(job.AssetId, own, StringComparison.Ordinal))
            {
                return GateDecision.Refuse("job assinado para outro ativo (assetId do job difere do desta maquina)");
            }
            if (nowUnix > job.NotAfter + ClockToleranceSeconds)
            {
                return GateDecision.Refuse(
                    "assinatura do job expirada (notAfter=" + job.NotAfter.ToString(CultureInfo.InvariantCulture) +
                    ", agora=" + nowUnix.ToString(CultureInfo.InvariantCulture) +
                    ", tolerancia=" + ClockToleranceSeconds.ToString(CultureInfo.InvariantCulture) + "s)");
            }
            if (!ReplayStore.IsValidId(job.JobId))
            {
                return GateDecision.Refuse("jobId com formato invalido");
            }
            if (seenIds != null && seenIds.Contains(job.JobId))
            {
                return GateDecision.Refuse("jobId ja visto (replay de job)");
            }
            return GateDecision.Allow("job assinado, valido para este ativo e dentro da validade");
        }
    }

    /// <summary>Descricao da postura de confianca, para o log de inicializacao.</summary>
    internal static class TrustPosture
    {
        internal static string Fingerprint(string publicKeyBase64)
        {
            try
            {
                byte[] der = Convert.FromBase64String((publicKeyBase64 ?? "").Trim());
                return Hashing.Sha256Hex(der).Substring(0, 16);
            }
            catch (FormatException)
            {
                return "invalida";
            }
        }

        internal static List<KeyValuePair<string, string>> Describe(AgentConfig config)
        {
            List<KeyValuePair<string, string>> lines = new List<KeyValuePair<string, string>>();
            DescribeOne(lines, "Atualizacao automatica", "releasePublicKey", config.releasePublicKey, config.allowUnsignedUpdates);
            DescribeOne(lines, "Jobs de script", "jobSigningPublicKey", config.jobSigningPublicKey, config.allowUnsignedJobs);
            return lines;
        }

        private static void DescribeOne(
            List<KeyValuePair<string, string>> lines, string what, string keyName, string key, bool allowUnsigned)
        {
            string trimmed = (key ?? "").Trim();
            if (trimmed.Length > 0)
            {
                if (SignatureVerifier.IsValidPublicKey(trimmed))
                {
                    lines.Add(new KeyValuePair<string, string>(
                        Log.LevelInfo, what + ": assinatura obrigatoria (" + keyName + " fingerprint " + Fingerprint(trimmed) + ")."));
                }
                else
                {
                    lines.Add(new KeyValuePair<string, string>(
                        Log.LevelError, what + ": " + keyName + " configurada mas INVALIDA; tudo sera recusado ate corrigir o config.json."));
                }
            }
            else if (allowUnsigned)
            {
                lines.Add(new KeyValuePair<string, string>(
                    Log.LevelWarn, what + ": " + keyName + " ausente e opt-out allowUnsigned ligado; SEM verificacao de assinatura."));
            }
            else
            {
                lines.Add(new KeyValuePair<string, string>(
                    Log.LevelWarn, what + ": " + keyName + " nao configurada; ignorados/recusados (seguro por padrao)."));
            }
        }
    }

    internal static class AtomicFile
    {
        /// <summary>
        /// Escrita atomica: arquivo temporario na mesma pasta + troca. Quem le
        /// nunca ve um arquivo pela metade. File.Move(overwrite) so existe no
        /// .NET moderno; no Framework usa-se File.Replace quando o destino existe.
        /// </summary>
        internal static void WriteAllText(string path, string content)
        {
            string directory = Path.GetDirectoryName(Path.GetFullPath(path));
            if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
            string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                File.WriteAllText(temporary, content, new UTF8Encoding(false));
                if (File.Exists(path)) File.Replace(temporary, path, null);
                else File.Move(temporary, path);
            }
            catch (Exception writeError)
            {
                try
                {
                    if (File.Exists(temporary)) File.Delete(temporary);
                }
                catch (Exception cleanupError)
                {
                    Log.BestEffort("apagar temporario de escrita atomica " + temporary, cleanupError);
                }
                Log.BestEffort("escrita atomica de " + path, writeError, Log.LevelWarn);
                throw;
            }
        }
    }

    /// <summary>
    /// Memoria persistente dos ultimos jobIds executados (anti-replay):
    /// um id por linha, mais recente no fim, no maximo <see cref="Capacity"/>.
    /// 500 e folgado: com validade de 15 min e heartbeat minimo de 30 s, nunca
    /// ha mais de ~30 jobs validos ao mesmo tempo; ids mais antigos ja expiraram.
    /// </summary>
    internal sealed class ReplayStore : ICollection<string>
    {
        internal const int Capacity = 500;
        private const int MaxIdLength = 180;

        private readonly string path;
        private readonly List<string> order = new List<string>();
        private readonly HashSet<string> members = new HashSet<string>(StringComparer.Ordinal);

        private ReplayStore(string path)
        {
            this.path = path;
        }

        internal static bool IsValidId(string id)
        {
            if (string.IsNullOrEmpty(id) || id.Length > MaxIdLength) return false;
            foreach (char c in id)
            {
                bool ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                    c == '-' || c == '_' || c == '.' || c == ':';
                if (!ok) return false;
            }
            return true;
        }

        /// <summary>Carrega do disco. Nunca lanca: arquivo ausente, ilegivel ou corrompido gera loja vazia (e log).</summary>
        internal static ReplayStore Load(string path)
        {
            ReplayStore store = new ReplayStore(path);
            if (!File.Exists(path)) return store;
            string text;
            try
            {
                text = File.ReadAllText(path, Encoding.UTF8);
            }
            catch (Exception readError)
            {
                Log.Warn("Nao foi possivel ler o registro anti-replay de jobs (" + path + "); iniciando vazio: " +
                    readError.GetType().Name + ": " + readError.Message);
                return store;
            }
            int invalid = 0;
            foreach (string rawLine in text.Split('\n'))
            {
                string line = rawLine.Trim();
                if (line.Length == 0) continue;
                if (!IsValidId(line))
                {
                    invalid++;
                    continue;
                }
                store.AddInMemory(line);
            }
            if (invalid > 0)
            {
                Log.Warn("Registro anti-replay de jobs com " + invalid + " linha(s) invalida(s) ignorada(s) (" + path + ").");
            }
            return store;
        }

        private void AddInMemory(string id)
        {
            if (members.Contains(id)) order.Remove(id);
            order.Add(id);
            members.Add(id);
            while (order.Count > Capacity)
            {
                members.Remove(order[0]);
                order.RemoveAt(0);
            }
        }

        /// <summary>
        /// Registra o id e persiste de forma atomica. Retorna false (e desfaz a
        /// mudanca em memoria) se nao foi possivel persistir: quem executa
        /// codigo com privilegio nao pode seguir sem a garantia anti-replay.
        /// </summary>
        internal bool TryRecord(string id, out string error)
        {
            error = null;
            if (!IsValidId(id))
            {
                error = "jobId com formato invalido";
                return false;
            }
            List<string> snapshot = new List<string>(order);
            AddInMemory(id);
            try
            {
                AtomicFile.WriteAllText(path, string.Join("\n", order.ToArray()) + "\n");
                return true;
            }
            catch (Exception persistError)
            {
                order.Clear();
                members.Clear();
                foreach (string previous in snapshot)
                {
                    order.Add(previous);
                    members.Add(previous);
                }
                error = "nao foi possivel gravar o registro anti-replay: " + persistError.GetType().Name + ": " + persistError.Message;
                return false;
            }
        }

        public bool Contains(string id) { return id != null && members.Contains(id); }
        public int Count { get { return order.Count; } }
        public bool IsReadOnly { get { return false; } }
        public void Add(string item) { throw new NotSupportedException("use TryRecord"); }
        public bool Remove(string item) { throw new NotSupportedException(); }
        public void Clear() { throw new NotSupportedException(); }
        public void CopyTo(string[] array, int arrayIndex) { order.CopyTo(array, arrayIndex); }
        public IEnumerator<string> GetEnumerator() { return order.GetEnumerator(); }
        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() { return order.GetEnumerator(); }
    }
}
