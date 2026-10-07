using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;

namespace ITGuardian.Windows
{
    /// <summary>
    /// Ponte entre o coletor IT Guardian e o cliente RustDesk instalado na
    /// mesma maquina (ver docs/ASSISTENCIA-REMOTA.md, secao "Transporte
    /// RustDesk"). O coletor nunca decide para onde o video/controle vai --
    /// so aplica a senha de sessao que o backend gerou (comando
    /// "rustdesk_set_password", ver RemoteAssistanceTrayController.ApplyCommands)
    /// e a revoga sozinho apos o TTL recebido, mesmo que o comando de
    /// revogacao do servidor se perca (agente offline, rede caiu no momento
    /// do encerramento) -- essa e a garantia real de expiracao, nao um aviso
    /// do servidor (ver issueRustdeskSessionPassword em
    /// server/src/services/remoteAssistanceService.js).
    ///
    /// NOTA DE VERIFICACAO (nao testado neste ambiente): os flags de linha de
    /// comando do rustdesk.exe (--password, --get-id) sao os documentados
    /// publicamente pelo projeto RustDesk nas versoes disponiveis ate a
    /// escrita deste arquivo. O RustDesk nao e mantido pelo IT Guardian --
    /// confirme esses flags contra a versao efetivamente empacotada no
    /// instalador (ver installers/windows-collector/README.md) antes de
    /// habilitar REMOTE_ASSISTANCE_RUSTDESK_ENABLED em producao.
    /// </summary>
    internal static class RustdeskController
    {
        private static readonly object syncRoot = new object();
        private static Timer expiryTimer;
        private static volatile bool sessionPasswordActive;

        /// <summary>
        /// True somente entre um "rustdesk_set_password" aplicado com sucesso
        /// e o clear correspondente (por TTL, por comando ou pelo fim local da
        /// sessao). Deixa o chamador (ResetUi) evitar invocar o RustDesk a toa
        /// em toda sessao de snapshot_polling/webrtc, onde nunca ha senha
        /// ativa para limpar.
        /// </summary>
        internal static bool HasActiveSessionPassword
        {
            get { return sessionPasswordActive; }
        }

        /// <summary>
        /// Caminho configurado explicitamente (config.json -> rustdeskExecutablePath),
        /// definido uma vez em Program.Main. Nulo/vazio cai na deteccao pelos
        /// caminhos de instalacao padrao.
        /// </summary>
        internal static string ExecutablePathOverride;

        internal static string ResolveExecutablePath()
        {
            if (!string.IsNullOrWhiteSpace(ExecutablePathOverride) && File.Exists(ExecutablePathOverride))
            {
                return ExecutablePathOverride;
            }
            string[] candidates =
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RustDesk", "rustdesk.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "RustDesk", "rustdesk.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "RustDesk", "rustdesk.exe")
            };
            foreach (string candidate in candidates)
            {
                if (File.Exists(candidate)) return candidate;
            }
            return null;
        }

        /// <summary>
        /// Le o id do dispositivo RustDesk (equivalente a um numero de
        /// telefone no protocolo -- nao e segredo). Tenta a CLI primeiro
        /// (fonte mais confiavel, reflete o estado atual do processo) e cai
        /// para leitura direta do arquivo de configuracao do RustDesk se a
        /// CLI falhar ou o cliente ainda nao tiver sido aberto uma vez.
        /// </summary>
        internal static string TryReadDeviceId()
        {
            string fromCli = TryReadDeviceIdFromCli();
            if (!string.IsNullOrWhiteSpace(fromCli)) return fromCli;
            return TryReadDeviceIdFromConfigFile();
        }

        private static string TryReadDeviceIdFromCli()
        {
            string exe = ResolveExecutablePath();
            if (exe == null) return null;
            try
            {
                using (Process process = StartHidden(exe, "--get-id"))
                {
                    if (process == null) return null;
                    string output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit(5000);
                    string trimmed = (output ?? string.Empty).Trim();
                    return Regex.IsMatch(trimmed, "^[0-9]{6,15}$") ? trimmed : null;
                }
            }
            catch (Exception error)
            {
                Program.WriteLog("WARN", "Falha ao ler id RustDesk via CLI: " + error.Message);
                return null;
            }
        }

        private static string ConfigFilePath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "RustDesk", "config", "RustDesk2.toml");
        }

        /// <summary>
        /// Aponta o cliente RustDesk desta maquina para o relay proprio do IT
        /// Guardian, em vez do relay publico do RustDesk (o padrao de fabrica
        /// de qualquer instalacao nova). Sem isso, o self-hosting configurado
        /// no backend (REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER) fica so de
        /// fachada -- o cliente registraria o id no relay publico mesmo.
        ///
        /// Edita o arquivo de configuracao diretamente (nao a CLI): e o
        /// mecanismo mais estavel entre versoes do RustDesk para configuracao
        /// nao-interativa de servidor, usado por varios guias de deploy
        /// customizado do proprio projeto. So reescreve quando o valor muda,
        /// para nao mexer no arquivo a toa em todo ciclo. Uma mudanca so tem
        /// efeito completo depois do cliente RustDesk ser reaberto -- este
        /// metodo nao reinicia nada sozinho.
        ///
        /// NOTA DE VERIFICACAO (nao testado neste ambiente): os nomes de
        /// chave ("id-server", "relay-server", "key") sao os documentados
        /// publicamente pelo formato RustDesk2.toml nas versoes disponiveis
        /// ate a escrita deste arquivo. Confirme contra a versao efetivamente
        /// empacotada antes de depender disso em producao.
        /// </summary>
        internal static bool EnsureServerConfigured(string idServer, string relayServer, string key)
        {
            if (string.IsNullOrWhiteSpace(idServer)) return false;
            try
            {
                string path = ConfigFilePath();
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                string[] existingLines = File.Exists(path) ? File.ReadAllLines(path) : new string[0];

                string currentIdServer = ReadTomlValue(existingLines, "id-server");
                string currentRelayServer = ReadTomlValue(existingLines, "relay-server");
                string currentKey = ReadTomlValue(existingLines, "key");
                if (currentIdServer == idServer && currentRelayServer == (relayServer ?? "") && currentKey == (key ?? ""))
                {
                    return false;
                }

                List<string> updatedLines = new List<string>(existingLines);
                SetTomlValue(updatedLines, "id-server", idServer);
                SetTomlValue(updatedLines, "relay-server", relayServer ?? "");
                SetTomlValue(updatedLines, "key", key ?? "");
                File.WriteAllLines(path, updatedLines.ToArray());
                Program.WriteLog("INFO", "Cliente RustDesk apontado para o relay proprio do IT Guardian (reabra o RustDesk para aplicar).");
                return true;
            }
            catch (Exception error)
            {
                Program.WriteLog("WARN", "Falha ao configurar servidor RustDesk proprio: " + error.Message);
                return false;
            }
        }

        private static string ReadTomlValue(string[] lines, string key)
        {
            Regex pattern = new Regex("^" + Regex.Escape(key) + "\\s*=\\s*'([^']*)'");
            foreach (string line in lines)
            {
                Match match = pattern.Match(line.Trim());
                if (match.Success) return match.Groups[1].Value;
            }
            return null;
        }

        private static void SetTomlValue(List<string> lines, string key, string value)
        {
            Regex pattern = new Regex("^" + Regex.Escape(key) + "\\s*=");
            string newLine = key + " = '" + value.Replace("'", "\\'") + "'";
            for (int i = 0; i < lines.Count; i++)
            {
                if (pattern.IsMatch(lines[i].Trim()))
                {
                    lines[i] = newLine;
                    return;
                }
            }
            lines.Add(newLine);
        }

        private static string TryReadDeviceIdFromConfigFile()
        {
            try
            {
                string path = ConfigFilePath();
                if (!File.Exists(path)) return null;
                foreach (string line in File.ReadAllLines(path))
                {
                    Match match = Regex.Match(line.Trim(), "^id\\s*=\\s*'([0-9]{6,15})'");
                    if (match.Success) return match.Groups[1].Value;
                }
            }
            catch (Exception error)
            {
                Program.WriteLog("WARN", "Falha ao ler id RustDesk do arquivo de configuracao: " + error.Message);
            }
            return null;
        }

        /// <summary>
        /// Aplica a senha de sessao recebida do backend e agenda a propria
        /// expiracao local (defesa em profundidade: nao depende do comando
        /// de revogacao do servidor chegar).
        /// </summary>
        internal static void SetSessionPassword(string password, int ttlSeconds)
        {
            lock (syncRoot)
            {
                if (!ApplyPassword(password)) return;
                sessionPasswordActive = true;
                ScheduleExpiry(Math.Max(10, ttlSeconds));
            }
        }

        internal static void ClearSessionPassword()
        {
            lock (syncRoot)
            {
                CancelScheduledExpiry();
                sessionPasswordActive = false;
                // Senha aleatoria gerada localmente e nunca transmitida a
                // lugar nenhum -- o unico objetivo e deixar de aceitar a
                // senha da sessao que acabou.
                ApplyPassword(GenerateLocalRandomPassword());
            }
        }

        private static void ScheduleExpiry(int ttlSeconds)
        {
            CancelScheduledExpiry();
            expiryTimer = new Timer(
                delegate { ClearSessionPassword(); },
                null,
                TimeSpan.FromSeconds(ttlSeconds),
                Timeout.InfiniteTimeSpan);
        }

        private static void CancelScheduledExpiry()
        {
            if (expiryTimer != null)
            {
                expiryTimer.Dispose();
                expiryTimer = null;
            }
        }

        private static bool ApplyPassword(string password)
        {
            string exe = ResolveExecutablePath();
            if (exe == null)
            {
                Program.WriteLog("WARN", "RustDesk nao encontrado nesta maquina; senha de sessao nao aplicada.");
                return false;
            }
            try
            {
                using (Process process = StartHidden(exe, "--password " + QuoteArgument(password)))
                {
                    if (process == null) return false;
                    // ExitCode so pode ser lido depois de confirmar que o
                    // processo terminou -- lê-lo apos um WaitForExit que
                    // estourou o timeout (retorno false) lanca excecao.
                    bool exited = process.WaitForExit(5000);
                    return exited && process.ExitCode == 0;
                }
            }
            catch (Exception error)
            {
                Program.WriteLog("WARN", "Falha ao aplicar senha de sessao no RustDesk: " + error.Message);
                return false;
            }
        }

        private static string GenerateLocalRandomPassword()
        {
            byte[] buffer = new byte[16];
            using (RandomNumberGenerator rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(buffer);
            }
            return Convert.ToBase64String(buffer).Replace("=", "").Replace("+", "").Replace("/", "");
        }

        private static string QuoteArgument(string value)
        {
            return "\"" + (value ?? string.Empty).Replace("\"", "\\\"") + "\"";
        }

        private static Process StartHidden(string exePath, string arguments)
        {
            ProcessStartInfo startInfo = new ProcessStartInfo(exePath, arguments)
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            return Process.Start(startInfo);
        }
    }
}
