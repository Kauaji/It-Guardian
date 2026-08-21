using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Management;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("IT Guardian")]
[assembly: System.Reflection.AssemblyDescription("Inventario e presenca do IT Guardian")]
[assembly: System.Reflection.AssemblyCompany("IT Guardian")]
[assembly: System.Reflection.AssemblyProduct("IT Guardian")]
[assembly: System.Reflection.AssemblyVersion("1.6.3.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.6.3.0")]

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
    }

    internal sealed class AgentHeartbeatResponse
    {
        public string assetId { get; set; }
        public bool remoteScriptExecutionEnabled { get; set; }
        public AgentScriptJob job { get; set; }
        public string latestVersion { get; set; }
        public string latestVersionDownloadUrl { get; set; }
        public string latestVersionSha256 { get; set; }
    }

    internal sealed class AgentScriptJob
    {
        public string id { get; set; }
        public string scriptId { get; set; }
        public string name { get; set; }
        public string type { get; set; }
        public string content { get; set; }
        public int timeoutSeconds { get; set; }
        public bool requiresAdmin { get; set; }
        public bool requiresLoggedUser { get; set; }
    }

    internal sealed class AgentScriptResult
    {
        public int? exitCode { get; set; }
        public bool timedOut { get; set; }
        public string stdout { get; set; }
        public string stderr { get; set; }
        public string errorMessage { get; set; }
    }

    internal static class Program
    {
        private const string AgentVersion = "1.6.3";
        private const int MaxInventoryPayloadBytes = 1024 * 1024;
        private const int MaximumOutputLength = 65536;
        // Codigo de saida nao-zero de proposito: RestartCount/RestartInterval, ja
        // configurados na tarefa agendada pelo instalador, so relancam o processo
        // quando o Task Scheduler considera a execucao uma "falha" -- ou seja,
        // qualquer saida diferente de zero. Reaproveita esse mecanismo existente
        // em vez de criar um novo gatilho so para a auto-atualizacao.
        private const int AutoUpdateRestartExitCode = 42;
        private const int MinUpdateBinaryBytes = 100 * 1024;
        private const int MaxUpdateBinaryBytes = 50 * 1024 * 1024;

        [STAThread]
        private static int Main(string[] args)
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            string configPath = ArgumentValue(args, "--config")
                ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");

            try
            {
                if (HasArgument(args, "--collector"))
                {
                    RunCollector(configPath, HasArgument(args, "--once"));
                    return 0;
                }

                RunTray(configPath);
                return 0;
            }
            catch (Exception error)
            {
                WriteLog("ERROR", error.Message);
                return 1;
            }
        }

        private static bool HasArgument(string[] args, string name)
        {
            foreach (string argument in args)
            {
                if (string.Equals(argument, name, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static string ArgumentValue(string[] args, string name)
        {
            for (int index = 0; index < args.Length - 1; index++)
            {
                if (string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase))
                {
                    return args[index + 1];
                }
            }
            return null;
        }

        private static AgentConfig ReadConfig(string path)
        {
            if (!File.Exists(path)) throw new InvalidOperationException("Configuracao do IT Guardian nao encontrada.");
            AgentConfig config = new JavaScriptSerializer().Deserialize<AgentConfig>(File.ReadAllText(path));
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

        private static void RunTray(string configPath)
        {
            bool created;
            using (Mutex mutex = new Mutex(true, "Local\\ITGuardianTray", out created))
            {
                if (!created) return;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayApplicationContext(configPath));
            }
        }

        private static void RunCollector(string configPath, bool runOnce)
        {
            AgentConfig config = ReadConfig(configPath);
            if (string.IsNullOrWhiteSpace(config.agentToken))
            {
                throw new InvalidOperationException("agentToken e obrigatorio.");
            }

            WriteLog("INFO", "Coletor IT Guardian " + AgentVersion + " iniciado.");
            RemoteAssistanceBroker remoteAssistanceBroker = null;
            if (!runOnce && RemoteAssistanceEnvironment.IsAllowed(config))
            {
                remoteAssistanceBroker = new RemoteAssistanceBroker(config);
                remoteAssistanceBroker.Start();
            }

            bool restartForUpdate = false;
            try
            {
                do
                {
                    try
                    {
                        restartForUpdate = SendInventory(config, runOnce);
                    }
                    catch (Exception error)
                    {
                        WriteLog("ERROR", error.Message);
                        if (runOnce) throw;
                    }

                    if (restartForUpdate) break;

                    if (!runOnce)
                    {
                        WaitForNextHeartbeat(config.intervalSeconds);
                        config = ReadConfig(configPath);
                    }
                }
                while (!runOnce);
            }
            finally
            {
                if (remoteAssistanceBroker != null)
                {
                    remoteAssistanceBroker.Dispose();
                }
            }

            if (restartForUpdate)
            {
                WriteLog("INFO", "Encerrando para reiniciar sob o binario atualizado.");
                Environment.Exit(AutoUpdateRestartExitCode);
            }
        }

        private static void WaitForNextHeartbeat(int intervalSeconds)
        {
            DateTime dueAt = DateTime.UtcNow.AddSeconds(intervalSeconds);
            while (DateTime.UtcNow < dueAt)
            {
                TimeSpan remaining = dueAt - DateTime.UtcNow;
                int waitMilliseconds = (int)Math.Min(5000, Math.Max(250, remaining.TotalMilliseconds));
                Thread.Sleep(waitMilliseconds);
            }
        }

        private static bool SendInventory(AgentConfig config, bool skipAutoUpdate = false)
        {
            Dictionary<string, object> payload = CollectInventory(config);
            string endpoint = config.serverUrl.TrimEnd('/') + "/api/agents/heartbeat";
            byte[] body = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(payload));
            if (body.Length > MaxInventoryPayloadBytes)
            {
                throw new InvalidOperationException("Inventario excede o limite seguro de 1 MB.");
            }
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(endpoint);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Accept = "application/json";
            request.Headers[HttpRequestHeader.Authorization] = "Bearer " + config.agentToken;
            request.Timeout = 30000;
            request.ReadWriteTimeout = 30000;
            request.ContentLength = body.Length;
            using (Stream requestStream = request.GetRequestStream())
            {
                requestStream.Write(body, 0, body.Length);
            }
            AgentHeartbeatResponse heartbeat;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            {
                if ((int)response.StatusCode < 200 || (int)response.StatusCode >= 300)
                {
                    throw new InvalidOperationException("Heartbeat recusado pelo servidor.");
                }
                using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                {
                    heartbeat = new JavaScriptSerializer().Deserialize<AgentHeartbeatResponse>(reader.ReadToEnd());
                }
            }
            WriteLog("INFO", "Inventario real enviado para " + config.serverUrl + ".");
            if (heartbeat != null && heartbeat.job != null)
            {
                WriteLog(
                    "INFO",
                    "Execucao remota habilitada no coletor: " + config.enableRemoteScriptExecution + "."
                );
                WriteLog(
                    "INFO",
                    "Servidor informou remoteScriptExecutionEnabled: " + heartbeat.remoteScriptExecutionEnabled + "."
                );
                if (heartbeat.remoteScriptExecutionEnabled && config.enableRemoteScriptExecution)
                {
                    ExecuteAndReportJob(config, heartbeat.job);
                }
                else
                {
                    string refusalReason = "Execucao remota nao habilitada no servidor e/ou no coletor.";
                    WriteLog("WARN", "Trabalho " + heartbeat.job.id + " recusado: " + refusalReason);
                    try
                    {
                        ReportJobRefused(config, heartbeat.job, refusalReason);
                    }
                    catch (Exception reportError)
                    {
                        WriteLog(
                            "ERROR",
                            "Falha ao reportar recusa do trabalho " + heartbeat.job.id + ": " + reportError.Message
                        );
                    }
                }
            }

            if (!skipAutoUpdate &&
                heartbeat != null &&
                !string.IsNullOrWhiteSpace(heartbeat.latestVersion) &&
                !string.IsNullOrWhiteSpace(heartbeat.latestVersionDownloadUrl) &&
                !string.IsNullOrWhiteSpace(heartbeat.latestVersionSha256))
            {
                try
                {
                    return ApplyUpdate(
                        heartbeat.latestVersion,
                        heartbeat.latestVersionDownloadUrl,
                        heartbeat.latestVersionSha256
                    );
                }
                catch (Exception updateError)
                {
                    WriteLog("ERROR", "Falha ao aplicar atualizacao automatica: " + updateError.Message);
                }
            }
            return false;
        }

        /// <summary>
        /// Baixa o binario indicado pelo servidor, confere o hash SHA-256 contra o
        /// valor esperado e so troca o executavel em uso se ele bater exatamente --
        /// sem certificado de assinatura em uso ainda, esse hash e a UNICA garantia
        /// de integridade, o mesmo modelo ja usado na pinagem de scripts de
        /// manutencao. Nunca lanca: qualquer falha (rede, hash divergente, tamanho
        /// fora do esperado) so cancela a atualizacao desta vez, sem afetar a
        /// coleta normal de inventario.
        /// </summary>
        private static bool ApplyUpdate(string newVersion, string downloadUrl, string expectedSha256)
        {
            Uri parsedUrl;
            if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out parsedUrl) ||
                parsedUrl.Scheme != Uri.UriSchemeHttps)
            {
                WriteLog("WARN", "URL de atualizacao ausente ou nao HTTPS; atualizacao automatica ignorada.");
                return false;
            }

            byte[] downloadedBytes;
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(parsedUrl);
            request.Method = "GET";
            request.Timeout = 120000;
            request.ReadWriteTimeout = 120000;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            {
                if ((int)response.StatusCode < 200 || (int)response.StatusCode >= 300)
                {
                    WriteLog("WARN", "Download da atualizacao recusado (" + (int)response.StatusCode + ").");
                    return false;
                }
                using (MemoryStream memory = new MemoryStream())
                {
                    response.GetResponseStream().CopyTo(memory);
                    downloadedBytes = memory.ToArray();
                }
            }

            if (downloadedBytes.Length < MinUpdateBinaryBytes || downloadedBytes.Length > MaxUpdateBinaryBytes)
            {
                WriteLog(
                    "WARN",
                    "Tamanho do binario baixado (" + downloadedBytes.Length +
                    " bytes) fora do intervalo esperado; atualizacao automatica ignorada."
                );
                return false;
            }

            string actualHash;
            using (SHA256 sha256 = SHA256.Create())
            {
                byte[] hashBytes = sha256.ComputeHash(downloadedBytes);
                StringBuilder builder = new StringBuilder(hashBytes.Length * 2);
                foreach (byte value in hashBytes)
                {
                    builder.Append(value.ToString("x2"));
                }
                actualHash = builder.ToString();
            }

            if (!string.Equals(actualHash, expectedSha256, StringComparison.OrdinalIgnoreCase))
            {
                WriteLog(
                    "ERROR",
                    "Hash do binario baixado nao confere com o esperado pelo servidor; atualizacao recusada."
                );
                return false;
            }

            string currentExecutablePath = Process.GetCurrentProcess().MainModule.FileName;
            string directory = Path.GetDirectoryName(currentExecutablePath);
            string downloadedPath = Path.Combine(directory, "ITGuardian.exe.new");
            string previousPath = Path.Combine(directory, "ITGuardian.exe.old");

            File.WriteAllBytes(downloadedPath, downloadedBytes);

            if (File.Exists(previousPath))
            {
                try { File.Delete(previousPath); } catch { }
            }
            File.Move(currentExecutablePath, previousPath);
            File.Move(downloadedPath, currentExecutablePath);

            WriteLog("INFO", "Atualizacao automatica aplicada: versao " + newVersion + ".");
            return true;
        }

        private static void ExecuteAndReportJob(AgentConfig config, AgentScriptJob job)
        {
            WriteLog(
                "INFO",
                "Trabalho recebido do servidor: id=" + job.id + " scriptId=" + job.scriptId +
                " nome=\"" + (job.name ?? "") + "\" tipo=" + job.type + "."
            );
            AgentScriptResult result = ExecuteJob(config, job);
            WriteLog(
                "INFO",
                "Execucao finalizada: id=" + job.id +
                " exitCode=" + (result.exitCode.HasValue ? result.exitCode.Value.ToString() : "n/a") +
                " timedOut=" + result.timedOut +
                (string.IsNullOrEmpty(result.errorMessage) ? "" : " erro=\"" + result.errorMessage + "\"") + "."
            );
            ReportJobResult(config, job, result);
        }

        // Sem isso, um trabalho ja "claimed" que o coletor recusa localmente
        // (flag desligada) nunca volta a ter um resultado reportado -- fica
        // preso em "claimed" no servidor para sempre. Reaproveita o mesmo
        // endpoint de resultado, com exitCode nulo (o servidor trata como
        // falha, nunca como sucesso) e a razao da recusa no errorMessage.
        private static void ReportJobRefused(AgentConfig config, AgentScriptJob job, string reason)
        {
            AgentScriptResult result = new AgentScriptResult
            {
                exitCode = null,
                timedOut = false,
                stdout = "",
                stderr = "",
                errorMessage = reason
            };
            ReportJobResult(config, job, result);
        }

        private static void ReportJobResult(AgentConfig config, AgentScriptJob job, AgentScriptResult result)
        {
            string endpoint =
                config.serverUrl.TrimEnd('/') + "/api/agents/jobs/" + Uri.EscapeDataString(job.id) + "/result";
            byte[] body = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(result));
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(endpoint);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Accept = "application/json";
            request.Headers[HttpRequestHeader.Authorization] = "Bearer " + config.agentToken;
            request.Timeout = 30000;
            request.ReadWriteTimeout = 30000;
            request.ContentLength = body.Length;
            using (Stream requestStream = request.GetRequestStream())
            {
                requestStream.Write(body, 0, body.Length);
            }
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            {
                if ((int)response.StatusCode < 200 || (int)response.StatusCode >= 300)
                {
                    throw new InvalidOperationException("O servidor recusou o resultado do script.");
                }
            }
            WriteLog("INFO", "Resultado do trabalho " + job.id + " enviado ao servidor.");
        }

        private static AgentScriptResult ExecuteJob(AgentConfig config, AgentScriptJob job)
        {
            AgentScriptResult result = new AgentScriptResult
            {
                stdout = "",
                stderr = "",
                errorMessage = ""
            };
            string type = (job.type ?? "").Trim().ToLowerInvariant();
            if (type != "bat" && type != "cmd" && type != "powershell")
            {
                result.errorMessage = "Tipo de script nao permitido pelo agente.";
                WriteLog("WARN", "Trabalho " + job.id + " recusado: " + result.errorMessage);
                return result;
            }
            if (job.requiresAdmin && !IsAdministrator())
            {
                result.errorMessage = "Este script exige um agente executado como administrador.";
                WriteLog("WARN", "Trabalho " + job.id + " recusado: " + result.errorMessage);
                return result;
            }
            if (job.requiresLoggedUser && !Environment.UserInteractive)
            {
                result.errorMessage = "Este script exige uma sessao interativa de usuario.";
                WriteLog("WARN", "Trabalho " + job.id + " recusado: " + result.errorMessage);
                return result;
            }

            WriteLog("INFO", "Iniciando execucao do trabalho " + job.id + " (tipo=" + type + ").");

            string extension = type == "powershell" ? ".ps1" : ".cmd";
            string temporaryPath = Path.Combine(
                Path.GetTempPath(),
                "it-guardian-" + Guid.NewGuid().ToString("N") + extension
            );
            try
            {
                File.WriteAllText(temporaryPath, ExpandScriptVariables(config, job.content), new UTF8Encoding(false));
                string executable;
                string arguments;
                if (type == "powershell")
                {
                    executable = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.System),
                        "WindowsPowerShell",
                        "v1.0",
                        "powershell.exe"
                    );
                    arguments =
                        "-NoLogo -NonInteractive -NoProfile -ExecutionPolicy Bypass -File \"" +
                        temporaryPath +
                        "\"";
                }
                else
                {
                    executable = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.System),
                        "cmd.exe"
                    );
                    arguments = "/D /S /C \"\"" + temporaryPath + "\"\"";
                }

                StringBuilder standardOutput = new StringBuilder();
                StringBuilder standardError = new StringBuilder();
                using (Process process = new Process())
                {
                    process.StartInfo = new ProcessStartInfo
                    {
                        FileName = executable,
                        Arguments = arguments,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true,
                        WorkingDirectory = Path.GetTempPath()
                    };
                    process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args)
                    {
                        if (args.Data != null && standardOutput.Length < MaximumOutputLength)
                        {
                            standardOutput.AppendLine(args.Data);
                        }
                    };
                    process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args)
                    {
                        if (args.Data != null && standardError.Length < MaximumOutputLength)
                        {
                            standardError.AppendLine(args.Data);
                        }
                    };
                    if (!process.Start()) throw new InvalidOperationException("O Windows nao iniciou o processo.");
                    process.BeginOutputReadLine();
                    process.BeginErrorReadLine();
                    int timeoutMilliseconds = Math.Max(15, Math.Min(600, job.timeoutSeconds)) * 1000;
                    if (!process.WaitForExit(timeoutMilliseconds))
                    {
                        result.timedOut = true;
                        try { process.Kill(); } catch { }
                        process.WaitForExit();
                        WriteLog(
                            "WARN",
                            "Trabalho " + job.id + " atingiu o tempo limite (" +
                            (timeoutMilliseconds / 1000) + "s) e foi encerrado."
                        );
                    }
                    else
                    {
                        process.WaitForExit();
                        result.exitCode = process.ExitCode;
                    }
                }
                result.stdout = LimitOutput(standardOutput.ToString());
                result.stderr = LimitOutput(standardError.ToString());
            }
            catch (Exception error)
            {
                result.errorMessage = LimitOutput(error.Message);
                WriteLog("ERROR", "Falha ao executar o trabalho " + job.id + ": " + error.Message);
            }
            finally
            {
                try
                {
                    if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
                }
                catch { }
            }
            return result;
        }

        private static bool IsAdministrator()
        {
            using (System.Security.Principal.WindowsIdentity identity =
                System.Security.Principal.WindowsIdentity.GetCurrent())
            {
                System.Security.Principal.WindowsPrincipal principal =
                    new System.Security.Principal.WindowsPrincipal(identity);
                return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
            }
        }

        private static string ExpandScriptVariables(AgentConfig config, string content)
        {
            Dictionary<string, string> values = new Dictionary<string, string>
            {
                { "CURRENT_USER", Environment.UserName },
                { "USER_PROFILE", Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) },
                { "TEMP_DIR", Path.GetTempPath().TrimEnd('\\') },
                { "HOSTNAME", Environment.MachineName },
                { "ASSET_NAME", config.machineAlias ?? Environment.MachineName },
                { "ASSET_IP", "" },
                { "OS_DRIVE", Path.GetPathRoot(Environment.SystemDirectory).TrimEnd('\\') },
                { "PROGRAM_DATA", Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData) }
            };
            string expanded = content ?? "";
            foreach (KeyValuePair<string, string> item in values)
            {
                expanded = expanded.Replace("{{" + item.Key + "}}", item.Value ?? "");
            }
            return expanded;
        }

        private static string LimitOutput(string value)
        {
            string normalized = value ?? "";
            return normalized.Length <= MaximumOutputLength
                ? normalized
                : normalized.Substring(0, MaximumOutputLength);
        }

        private static Dictionary<string, object> CollectInventory(AgentConfig config)
        {
            ManagementObject os = First("SELECT * FROM Win32_OperatingSystem");
            ManagementObject cpu = First("SELECT * FROM Win32_Processor");
            ManagementObject computer = First("SELECT * FROM Win32_ComputerSystem");
            ManagementObject bios = First("SELECT * FROM Win32_BIOS");
            ManagementObject disk = First("SELECT * FROM Win32_LogicalDisk WHERE DeviceID='C:'");
            ManagementObject network = First(
                "SELECT * FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled=True"
            );

            long totalMemory = ToLong(Value(os, "TotalVisibleMemorySize")) * 1024L;
            long freeMemory = ToLong(Value(os, "FreePhysicalMemory")) * 1024L;
            string machineGuid = Convert.ToString(
                Registry.GetValue(
                    @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography",
                    "MachineGuid",
                    Environment.MachineName
                )
            );
            string localIp = FirstIpv4(Value(network, "IPAddress") as string[]);
            DateTime bootTime = ManagementDateTimeConverter.ToDateTime(
                Convert.ToString(Value(os, "LastBootUpTime"))
            );

            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["machineId"] = string.IsNullOrWhiteSpace(config.machineId) ? machineGuid : config.machineId;
            payload["hostname"] = Environment.MachineName;
            payload["machineAlias"] = config.machineAlias ?? "";
            payload["operatingSystem"] = Text(os, "Caption");
            payload["osArchitecture"] = Text(os, "OSArchitecture");
            payload["windowsVersion"] = Text(os, "Version");
            payload["localIp"] = localIp;
            payload["macAddress"] = Text(network, "MACAddress");
            payload["cpuModel"] = Text(cpu, "Name");
            payload["cpuUsagePercent"] = Clamp(ToInt(Value(cpu, "LoadPercentage")), 0, 100);
            payload["memoryTotalBytes"] = totalMemory;
            payload["memoryUsedBytes"] = Math.Max(0L, totalMemory - freeMemory);
            payload["memoryFreeBytes"] = freeMemory;
            payload["diskTotalBytes"] = ToLong(Value(disk, "Size"));
            payload["diskFreeBytes"] = ToLong(Value(disk, "FreeSpace"));
            payload["deviceManufacturer"] = Text(computer, "Manufacturer");
            payload["deviceModel"] = Text(computer, "Model");
            payload["serialNumber"] = Text(bios, "SerialNumber");
            payload["uptimeSeconds"] = Math.Max(0L, (long)(DateTime.Now - bootTime).TotalSeconds);
            payload["agentVersion"] = AgentVersion;
            payload["collectedAt"] = DateTime.UtcNow.ToString("o");
            payload["intervalSeconds"] = config.intervalSeconds;
            payload["environment"] = config.environment ?? "";
            payload["group"] = config.group ?? "";
            payload["segment"] = config.segment ?? "";
            string loggedUser = Text(computer, "UserName");
            if (string.IsNullOrWhiteSpace(loggedUser)) loggedUser = Environment.UserDomainName + "\\" + Environment.UserName;
            if (config.includeLoggedUser) payload["loggedUser"] = loggedUser;

            Dictionary<string, object> inventoryDetails = new Dictionary<string, object>();
            inventoryDetails["cpuCores"] = CollectCpuCoreCount();
            inventoryDetails["cpu"] = CollectCpuDetails();
            inventoryDetails["loggedUser"] = config.includeLoggedUser ? loggedUser : "";
            inventoryDetails["memoryHealth"] = CollectMemoryHealth();
            inventoryDetails["licenses"] = CollectLicenses();
            inventoryDetails["office"] = CollectOffice();
            inventoryDetails["graphics"] = CollectGraphicsAdapters();
            inventoryDetails["motherboard"] = CollectMotherboard();
            inventoryDetails["networkAdapters"] = CollectNetworkAdapters();
            inventoryDetails["battery"] = CollectBattery();
            inventoryDetails["peripherals"] = CollectPeripherals();
            inventoryDetails["disks"] = CollectPhysicalDisks(
                ToLong(Value(disk, "Size")),
                ToLong(Value(disk, "FreeSpace"))
            );
            inventoryDetails["software"] = CollectInstalledSoftware();
            payload["inventoryDetails"] = inventoryDetails;
            return payload;
        }

        private static Dictionary<string, object> CollectMemoryHealth()
        {
            Dictionary<string, object> result = new Dictionary<string, object>();
            List<string> warnings = new List<string>();
            List<Dictionary<string, object>> moduleDetails = new List<Dictionary<string, object>>();
            int modules = 0;
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT Status, Capacity, Speed, ConfiguredClockSpeed, Manufacturer, PartNumber, SerialNumber, BankLabel FROM Win32_PhysicalMemory"
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        modules++;
                        string status = Text(row, "Status");
                        Dictionary<string, object> module = new Dictionary<string, object>();
                        module["bank"] = Text(row, "BankLabel");
                        module["manufacturer"] = Text(row, "Manufacturer");
                        module["partNumber"] = Text(row, "PartNumber").Trim();
                        module["serialNumber"] = Text(row, "SerialNumber").Trim();
                        module["capacityGb"] = Math.Round(ToLong(Value(row, "Capacity")) / 1073741824d, 1);
                        module["speedMhz"] = ToInt(Value(row, "ConfiguredClockSpeed")) > 0
                            ? ToInt(Value(row, "ConfiguredClockSpeed"))
                            : ToInt(Value(row, "Speed"));
                        module["status"] = string.IsNullOrWhiteSpace(status) ? "Nao informado" : status;
                        moduleDetails.Add(module);
                        if (!string.IsNullOrWhiteSpace(status) &&
                            !string.Equals(status, "OK", StringComparison.OrdinalIgnoreCase))
                        {
                            warnings.Add(status);
                        }
                    }
                }
            }
            catch { }
            result["status"] = modules == 0
                ? "Nao disponibilizada pelo Windows"
                : warnings.Count == 0
                    ? "Sem falhas reportadas"
                    : string.Join(", ", warnings.ToArray());
            result["modules"] = modules;
            result["moduleDetails"] = moduleDetails;
            return result;
        }

        private static int CollectCpuCoreCount()
        {
            int cores = 0;
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT NumberOfCores FROM Win32_Processor"
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        cores += Math.Max(0, ToInt(Value(row, "NumberOfCores")));
                    }
                }
            }
            catch { }
            return cores > 0 ? cores : Math.Max(1, Environment.ProcessorCount);
        }

        private static Dictionary<string, object> CollectCpuDetails()
        {
            Dictionary<string, object> result = new Dictionary<string, object>();
            int cores = 0;
            int logicalProcessors = 0;
            int maxClockMhz = 0;
            int sockets = 0;
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed, SocketDesignation, VirtualizationFirmwareEnabled FROM Win32_Processor"
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        sockets++;
                        if (!result.ContainsKey("name")) result["name"] = Text(row, "Name");
                        cores += Math.Max(0, ToInt(Value(row, "NumberOfCores")));
                        logicalProcessors += Math.Max(0, ToInt(Value(row, "NumberOfLogicalProcessors")));
                        maxClockMhz = Math.Max(maxClockMhz, ToInt(Value(row, "MaxClockSpeed")));
                        if (!result.ContainsKey("socket")) result["socket"] = Text(row, "SocketDesignation");
                        object virtualization = Value(row, "VirtualizationFirmwareEnabled");
                        if (virtualization != null)
                        {
                            result["virtualizationEnabled"] = Convert.ToBoolean(virtualization);
                        }
                    }
                }
            }
            catch { }
            result["cores"] = cores > 0 ? cores : Math.Max(1, Environment.ProcessorCount);
            result["logicalProcessors"] = logicalProcessors > 0 ? logicalProcessors : Environment.ProcessorCount;
            result["maxClockMhz"] = maxClockMhz;
            result["sockets"] = sockets;
            return result;
        }

        private static List<Dictionary<string, object>> CollectGraphicsAdapters()
        {
            List<Dictionary<string, object>> adapters = new List<Dictionary<string, object>>();
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT Name, AdapterRAM, DriverVersion, VideoProcessor, Status, CurrentHorizontalResolution, CurrentVerticalResolution FROM Win32_VideoController"
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        Dictionary<string, object> adapter = new Dictionary<string, object>();
                        adapter["name"] = Text(row, "Name");
                        adapter["videoProcessor"] = Text(row, "VideoProcessor");
                        adapter["memoryBytes"] = ToLong(Value(row, "AdapterRAM"));
                        adapter["driverVersion"] = Text(row, "DriverVersion");
                        adapter["status"] = Text(row, "Status");
                        adapter["resolution"] = ToInt(Value(row, "CurrentHorizontalResolution")) > 0
                            ? ToInt(Value(row, "CurrentHorizontalResolution")) + "x" +
                              ToInt(Value(row, "CurrentVerticalResolution"))
                            : "";
                        adapters.Add(adapter);
                    }
                }
            }
            catch { }
            return adapters;
        }

        private static Dictionary<string, object> CollectMotherboard()
        {
            Dictionary<string, object> result = new Dictionary<string, object>();
            try
            {
                ManagementObject board = First("SELECT Manufacturer, Product, SerialNumber, Version, Status FROM Win32_BaseBoard");
                result["manufacturer"] = Text(board, "Manufacturer");
                result["product"] = Text(board, "Product");
                result["serialNumber"] = Text(board, "SerialNumber").Trim();
                result["version"] = Text(board, "Version");
                result["status"] = Text(board, "Status");
            }
            catch { }
            return result;
        }

        private static List<Dictionary<string, object>> CollectNetworkAdapters()
        {
            List<Dictionary<string, object>> adapters = new List<Dictionary<string, object>>();
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT Description, MACAddress, DHCPEnabled, IPAddress, DefaultIPGateway, DNSServerSearchOrder FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled=True"
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        Dictionary<string, object> adapter = new Dictionary<string, object>();
                        adapter["name"] = Text(row, "Description");
                        adapter["macAddress"] = Text(row, "MACAddress");
                        adapter["dhcpEnabled"] = Value(row, "DHCPEnabled") != null &&
                            Convert.ToBoolean(Value(row, "DHCPEnabled"));
                        adapter["ipAddresses"] = Value(row, "IPAddress") as string[] ?? new string[0];
                        adapter["gateways"] = Value(row, "DefaultIPGateway") as string[] ?? new string[0];
                        adapter["dnsServers"] = Value(row, "DNSServerSearchOrder") as string[] ?? new string[0];
                        adapters.Add(adapter);
                    }
                }
            }
            catch { }
            return adapters;
        }

        private static Dictionary<string, object> CollectBattery()
        {
            Dictionary<string, object> result = new Dictionary<string, object>();
            try
            {
                ManagementObject battery = First(
                    "SELECT Name, EstimatedChargeRemaining, BatteryStatus, EstimatedRunTime, Status FROM Win32_Battery"
                );
                result["name"] = Text(battery, "Name");
                result["chargePercent"] = ToInt(Value(battery, "EstimatedChargeRemaining"));
                result["batteryStatus"] = ToInt(Value(battery, "BatteryStatus"));
                result["estimatedMinutes"] = ToInt(Value(battery, "EstimatedRunTime"));
                result["status"] = Text(battery, "Status");
            }
            catch { }
            return result;
        }

        private static List<Dictionary<string, object>> CollectPeripherals()
        {
            List<Dictionary<string, object>> peripherals = new List<Dictionary<string, object>>();
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT Name, Manufacturer, PNPClass, DeviceID, Status FROM Win32_PnPEntity"
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        string name = Text(row, "Name").Trim();
                        string pnpClass = Text(row, "PNPClass").Trim();
                        string type = ResolvePeripheralType(name, pnpClass);
                        if (string.IsNullOrWhiteSpace(type) || string.IsNullOrWhiteSpace(name)) continue;
                        string deviceId = Text(row, "DeviceID");
                        string key = string.IsNullOrWhiteSpace(deviceId) ? type + "|" + name : deviceId;
                        if (!seen.Add(key)) continue;

                        Dictionary<string, object> peripheral = new Dictionary<string, object>();
                        peripheral["id"] = key;
                        peripheral["type"] = type;
                        peripheral["name"] = name;
                        peripheral["brand"] = Text(row, "Manufacturer");
                        peripheral["assetTag"] = "";
                        peripheral["status"] = Text(row, "Status");
                        peripherals.Add(peripheral);
                        if (peripherals.Count >= 100) break;
                    }
                }
            }
            catch { }
            return peripherals;
        }

        private static string ResolvePeripheralType(string name, string pnpClass)
        {
            string normalized = (name + " " + pnpClass).ToLowerInvariant();
            if (pnpClass.Equals("Monitor", StringComparison.OrdinalIgnoreCase) || normalized.Contains("monitor"))
                return "Monitor";
            if (pnpClass.Equals("Keyboard", StringComparison.OrdinalIgnoreCase) || normalized.Contains("keyboard") || normalized.Contains("teclado"))
                return "Teclado";
            if (pnpClass.Equals("Mouse", StringComparison.OrdinalIgnoreCase) || normalized.Contains("mouse"))
                return "Mouse";
            if (pnpClass.Equals("Printer", StringComparison.OrdinalIgnoreCase) || normalized.Contains("printer") || normalized.Contains("impressora"))
                return "Impressora";
            if (normalized.Contains("scanner")) return "Scanner";
            if (pnpClass.Equals("Camera", StringComparison.OrdinalIgnoreCase) ||
                pnpClass.Equals("Image", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("webcam") || normalized.Contains("camera"))
                return "Webcam";
            if (normalized.Contains("headset") || normalized.Contains("headphone") || normalized.Contains("fone"))
                return "Headset";
            if (normalized.Contains("dock") || normalized.Contains("docking"))
                return "Dockstation";
            return "";
        }

        private static Dictionary<string, object> CollectLicenses()
        {
            Dictionary<string, object> licenses = new Dictionary<string, object>();
            licenses["windowsKey"] = "Nao disponibilizada";
            licenses["officeKey"] = "Nao disponibilizada";
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT Name, LicenseStatus, PartialProductKey FROM SoftwareLicensingProduct WHERE PartialProductKey IS NOT NULL"
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        string name = Text(row, "Name");
                        string partialKey = Text(row, "PartialProductKey");
                        string status = LicenseStatusLabel(ToInt(Value(row, "LicenseStatus")));
                        string summary = status;
                        if (!string.IsNullOrWhiteSpace(partialKey)) summary += " - final " + partialKey;
                        if (name.IndexOf("Windows", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            licenses["windowsKey"] = summary;
                        }
                        else if (name.IndexOf("Office", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            licenses["officeKey"] = summary;
                        }
                    }
                }
            }
            catch { }
            return licenses;
        }

        private static string LicenseStatusLabel(int status)
        {
            switch (status)
            {
                case 1: return "Ativada";
                case 2: return "Periodo inicial";
                case 3: return "Periodo adicional";
                case 4: return "Nao genuina";
                case 5: return "Notificacao";
                case 6: return "Periodo estendido";
                default: return "Status desconhecido";
            }
        }

        private static Dictionary<string, object> CollectOffice()
        {
            Dictionary<string, object> office = new Dictionary<string, object>();
            try
            {
                object products = Registry.GetValue(
                    @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Office\ClickToRun\Configuration",
                    "ProductReleaseIds",
                    null
                );
                object version = Registry.GetValue(
                    @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Office\ClickToRun\Configuration",
                    "VersionToReport",
                    null
                );
                object platform = Registry.GetValue(
                    @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Office\ClickToRun\Configuration",
                    "Platform",
                    null
                );
                office["name"] = Convert.ToString(products) ?? "";
                office["version"] = Convert.ToString(version) ?? "";
                office["architecture"] = Convert.ToString(platform) ?? "";
            }
            catch { }
            if (string.IsNullOrWhiteSpace(Convert.ToString(office.ContainsKey("name") ? office["name"] : "")))
            {
                CollectOfficeFromUninstallRegistry(office);
            }
            return office;
        }

        private static void CollectOfficeFromUninstallRegistry(Dictionary<string, object> office)
        {
            RegistryHive[] hives = new RegistryHive[] { RegistryHive.LocalMachine, RegistryHive.Users };
            RegistryView[] views = new RegistryView[] { RegistryView.Registry64, RegistryView.Registry32 };
            foreach (RegistryHive hive in hives)
            {
                foreach (RegistryView view in views)
                {
                    try
                    {
                        using (RegistryKey baseKey = RegistryKey.OpenBaseKey(hive, view))
                        {
                            List<string> roots = new List<string>();
                            if (hive == RegistryHive.LocalMachine)
                            {
                                roots.Add(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
                            }
                            else
                            {
                                foreach (string sid in baseKey.GetSubKeyNames())
                                {
                                    if (sid.StartsWith("S-1-5-", StringComparison.OrdinalIgnoreCase))
                                    {
                                        roots.Add(sid + @"\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall");
                                    }
                                }
                            }

                            foreach (string rootPath in roots)
                            {
                                using (RegistryKey root = baseKey.OpenSubKey(rootPath))
                                {
                                    if (root == null) continue;
                                    foreach (string subKeyName in root.GetSubKeyNames())
                                    {
                                        using (RegistryKey item = root.OpenSubKey(subKeyName))
                                        {
                                            if (item == null) continue;
                                            string name = Convert.ToString(item.GetValue("DisplayName")) ?? "";
                                            if (name.IndexOf("Microsoft 365", StringComparison.OrdinalIgnoreCase) < 0 &&
                                                name.IndexOf("Microsoft Office", StringComparison.OrdinalIgnoreCase) < 0)
                                            {
                                                continue;
                                            }
                                            office["name"] = name.Trim();
                                            office["version"] = Convert.ToString(item.GetValue("DisplayVersion")) ?? "";
                                            office["architecture"] = view == RegistryView.Registry64 ? "x64" : "x86";
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch { }
                }
            }
        }

        private static List<Dictionary<string, object>> CollectPhysicalDisks(long systemTotal, long systemFree)
        {
            List<Dictionary<string, object>> disks = new List<Dictionary<string, object>>();
            List<Dictionary<string, object>> reliability = CollectStorageReliability();
            List<Dictionary<string, object>> legacySmart = CollectLegacySmartData();
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    "SELECT Model, SerialNumber, Size, Status, MediaType, InterfaceType FROM Win32_DiskDrive"
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    int index = 0;
                    foreach (ManagementObject row in rows)
                    {
                        long size = ToLong(Value(row, "Size"));
                        string status = Text(row, "Status");
                        Dictionary<string, object> disk = new Dictionary<string, object>();
                        disk["label"] = string.IsNullOrWhiteSpace(Text(row, "Model"))
                            ? "Disco fisico " + (index + 1)
                            : Text(row, "Model");
                        disk["name"] = disk["label"];
                        disk["model"] = Text(row, "Model");
                        disk["serialNumber"] = Text(row, "SerialNumber").Trim();
                        disk["sizeGb"] = Math.Round(size / 1073741824d, 1);
                        disk["totalBytes"] = size;
                        disk["freeBytes"] = index == 0 ? systemFree : 0L;
                        disk["type"] = ResolveDiskType(Text(row, "MediaType"), Text(row, "Model"));
                        disk["smartStatus"] = string.IsNullOrWhiteSpace(status) ? "Nao disponibilizado" : status;
                        disk["health"] = string.Equals(status, "OK", StringComparison.OrdinalIgnoreCase)
                            ? "Saudavel"
                            : status;

                        if (index < reliability.Count)
                        {
                            foreach (KeyValuePair<string, object> item in reliability[index])
                            {
                                disk[item.Key] = item.Value;
                            }
                        }
                        if (index < legacySmart.Count)
                        {
                            foreach (KeyValuePair<string, object> item in legacySmart[index])
                            {
                                if (!disk.ContainsKey(item.Key)) disk[item.Key] = item.Value;
                            }
                        }
                        int healthPercent = disk.ContainsKey("wearPercent")
                            ? Math.Max(0, 100 - ToInt(disk["wearPercent"]))
                            : disk.ContainsKey("lifeRemainingPercent")
                                ? Clamp(ToInt(disk["lifeRemainingPercent"]), 0, 100)
                            : string.Equals(status, "OK", StringComparison.OrdinalIgnoreCase) ? 100 : 50;
                        disk["healthPercent"] = healthPercent;
                        disk["healthEstimate"] = healthPercent + "% (estimativa SMART)";
                        disks.Add(disk);
                        index++;
                    }
                }
            }
            catch { }

            if (disks.Count == 0 && systemTotal > 0)
            {
                disks.Add(new Dictionary<string, object>
                {
                    { "label", "Disco do sistema" },
                    { "name", "Disco do sistema" },
                    { "sizeGb", Math.Round(systemTotal / 1073741824d, 1) },
                    { "totalBytes", systemTotal },
                    { "freeBytes", systemFree },
                    { "type", "Nao identificado" },
                    { "smartStatus", "Nao disponibilizado" }
                });
            }
            return disks;
        }

        private static List<Dictionary<string, object>> CollectStorageReliability()
        {
            List<Dictionary<string, object>> counters = new List<Dictionary<string, object>>();
            try
            {
                ManagementScope scope = new ManagementScope(@"\\.\root\Microsoft\Windows\Storage");
                scope.Connect();
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    scope,
                    new ObjectQuery("SELECT Temperature, PowerOnHours, Wear, ReadErrorsTotal, WriteErrorsTotal FROM MSFT_StorageReliabilityCounter")
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        Dictionary<string, object> counter = new Dictionary<string, object>();
                        long temperature = ToLong(Value(row, "Temperature"));
                        long hours = ToLong(Value(row, "PowerOnHours"));
                        object wearValue = Value(row, "Wear");
                        long wear = ToLong(wearValue);
                        if (temperature > 0) counter["temperatureC"] = temperature;
                        if (hours > 0) counter["powerOnHours"] = hours;
                        if (wearValue != null && wear >= 0 && wear <= 100) counter["wearPercent"] = wear;
                        counter["readErrors"] = ToLong(Value(row, "ReadErrorsTotal"));
                        counter["writeErrors"] = ToLong(Value(row, "WriteErrorsTotal"));
                        counters.Add(counter);
                    }
                }
            }
            catch { }
            return counters;
        }

        private static List<Dictionary<string, object>> CollectLegacySmartData()
        {
            List<Dictionary<string, object>> counters = new List<Dictionary<string, object>>();
            try
            {
                ManagementScope scope = new ManagementScope(@"\\.\root\wmi");
                scope.Connect();
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(
                    scope,
                    new ObjectQuery("SELECT VendorSpecific FROM MSStorageDriver_FailurePredictData")
                ))
                using (ManagementObjectCollection rows = searcher.Get())
                {
                    foreach (ManagementObject row in rows)
                    {
                        byte[] data = Value(row, "VendorSpecific") as byte[];
                        Dictionary<string, object> counter = new Dictionary<string, object>();
                        if (data == null || data.Length < 14)
                        {
                            counters.Add(counter);
                            continue;
                        }

                        for (int offset = 2; offset + 11 < data.Length; offset += 12)
                        {
                            int attributeId = data[offset];
                            if (attributeId == 0) continue;
                            long raw = 0;
                            for (int byteIndex = 0; byteIndex < 6; byteIndex++)
                            {
                                raw |= ((long)data[offset + 5 + byteIndex]) << (byteIndex * 8);
                            }

                            if (attributeId == 5) counter["reallocatedSectors"] = raw;
                            if (attributeId == 9 && !counter.ContainsKey("powerOnHours")) counter["powerOnHours"] = raw;
                            if (attributeId == 194 && !counter.ContainsKey("temperatureC")) counter["temperatureC"] = raw & 0xff;
                            if ((attributeId == 202 || attributeId == 231 || attributeId == 233) &&
                                !counter.ContainsKey("lifeRemainingPercent"))
                            {
                                counter["lifeRemainingPercent"] = Clamp(data[offset + 3], 0, 100);
                            }
                            if (attributeId == 241)
                            {
                                counter["tbWritten"] = Math.Round((raw * 512d) / 1000000000000d, 2);
                            }
                        }
                        counters.Add(counter);
                    }
                }
            }
            catch { }
            return counters;
        }

        private static string ResolveDiskType(string mediaType, string model)
        {
            string combined = (mediaType + " " + model).ToLowerInvariant();
            if (combined.Contains("ssd") || combined.Contains("solid state") || combined.Contains("nvme")) return "SSD";
            if (combined.Contains("fixed hard disk") || combined.Contains("hdd")) return "HDD";
            return string.IsNullOrWhiteSpace(mediaType) ? "Nao identificado" : mediaType;
        }

        private static List<Dictionary<string, object>> CollectInstalledSoftware()
        {
            Dictionary<string, Dictionary<string, object>> unique =
                new Dictionary<string, Dictionary<string, object>>(StringComparer.OrdinalIgnoreCase);
            CollectSoftwareRegistry(
                RegistryHive.LocalMachine,
                RegistryView.Registry64,
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                unique
            );
            CollectSoftwareRegistry(
                RegistryHive.LocalMachine,
                RegistryView.Registry32,
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                unique
            );
            CollectSoftwareRegistry(
                RegistryHive.CurrentUser,
                RegistryView.Default,
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                unique
            );
            CollectSoftwareForLoadedUsers(unique);
            List<Dictionary<string, object>> software = new List<Dictionary<string, object>>(unique.Values);
            software.Sort(delegate(Dictionary<string, object> left, Dictionary<string, object> right)
            {
                return string.Compare(
                    Convert.ToString(left["name"]),
                    Convert.ToString(right["name"]),
                    StringComparison.OrdinalIgnoreCase
                );
            });
            if (software.Count > 500) software.RemoveRange(500, software.Count - 500);
            return software;
        }

        private static void CollectSoftwareForLoadedUsers(
            Dictionary<string, Dictionary<string, object>> target
        )
        {
            RegistryView[] views = new RegistryView[] { RegistryView.Registry64, RegistryView.Registry32 };
            foreach (RegistryView view in views)
            {
                try
                {
                    using (RegistryKey users = RegistryKey.OpenBaseKey(RegistryHive.Users, view))
                    {
                        foreach (string sid in users.GetSubKeyNames())
                        {
                            if (!sid.StartsWith("S-1-5-", StringComparison.OrdinalIgnoreCase)) continue;
                            CollectSoftwareRegistry(
                                RegistryHive.Users,
                                view,
                                sid + @"\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                                target
                            );
                        }
                    }
                }
                catch { }
            }
        }

        private static void CollectSoftwareRegistry(
            RegistryHive hive,
            RegistryView view,
            string path,
            Dictionary<string, Dictionary<string, object>> target
        )
        {
            try
            {
                using (RegistryKey baseKey = RegistryKey.OpenBaseKey(hive, view))
                using (RegistryKey root = baseKey.OpenSubKey(path))
                {
                    if (root == null) return;
                    foreach (string subKeyName in root.GetSubKeyNames())
                    {
                        using (RegistryKey item = root.OpenSubKey(subKeyName))
                        {
                            if (item == null) continue;
                            string name = Convert.ToString(item.GetValue("DisplayName")) ?? "";
                            if (string.IsNullOrWhiteSpace(name) || Convert.ToInt32(item.GetValue("SystemComponent", 0)) == 1) continue;
                            Dictionary<string, object> row = new Dictionary<string, object>();
                            row["name"] = name.Trim();
                            row["version"] = Convert.ToString(item.GetValue("DisplayVersion")) ?? "";
                            row["manufacturer"] = Convert.ToString(item.GetValue("Publisher")) ?? "";
                            row["installedAt"] = NormalizeInstallDate(Convert.ToString(item.GetValue("InstallDate")));
                            target[name.Trim()] = row;
                        }
                    }
                }
            }
            catch { }
        }

        private static string NormalizeInstallDate(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length != 8) return "";
            DateTime parsed;
            return DateTime.TryParseExact(
                value,
                "yyyyMMdd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None,
                out parsed
            ) ? parsed.ToString("o") : "";
        }

        private static ManagementObject First(string query)
        {
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(query))
            using (ManagementObjectCollection results = searcher.Get())
            {
                foreach (ManagementObject item in results) return item;
            }
            throw new InvalidOperationException("O Windows nao retornou os dados de inventario esperados.");
        }

        private static object Value(ManagementObject item, string name)
        {
            return item == null ? null : item[name];
        }

        private static string Text(ManagementObject item, string name)
        {
            return Convert.ToString(Value(item, name)) ?? "";
        }

        private static int ToInt(object value)
        {
            int result;
            return int.TryParse(Convert.ToString(value), out result) ? result : 0;
        }

        private static long ToLong(object value)
        {
            long result;
            return long.TryParse(Convert.ToString(value), out result) ? result : 0L;
        }

        private static int Clamp(int value, int minimum, int maximum)
        {
            return Math.Max(minimum, Math.Min(maximum, value));
        }

        private static string FirstIpv4(string[] addresses)
        {
            if (addresses == null) return "";
            foreach (string address in addresses)
            {
                IPAddress parsed;
                if (IPAddress.TryParse(address, out parsed) &&
                    parsed.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                {
                    return address;
                }
            }
            return "";
        }

        internal static void WriteLog(string level, string message)
        {
            try
            {
                string logDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "logs");
                Directory.CreateDirectory(logDirectory);
                string logPath = Path.Combine(logDirectory, "agent.log");
                if (File.Exists(logPath) && new FileInfo(logPath).Length > 2 * 1024 * 1024)
                {
                    File.Copy(logPath, Path.Combine(logDirectory, "agent.previous.log"), true);
                    File.Delete(logPath);
                }
                File.AppendAllText(
                    logPath,
                    DateTime.UtcNow.ToString("o") + " [" + level + "] " + message + Environment.NewLine
                );
            }
            catch
            {
                // Falhas de telemetria local nunca podem encerrar o coletor ou a bandeja.
            }
        }
    }

    internal sealed class TrayApplicationContext : ApplicationContext
    {
        private readonly NotifyIcon trayIcon;
        private readonly RemoteAssistanceTrayController remoteAssistance;

        internal TrayApplicationContext(string configPath)
        {
            try
            {
                if (File.Exists(configPath))
                {
                    new JavaScriptSerializer().Deserialize<AgentConfig>(File.ReadAllText(configPath));
                }
            }
            catch (Exception error)
            {
                Program.WriteLog("WARN", "Nao foi possivel ler a configuracao da bandeja: " + error.Message);
            }

            Icon applicationIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            trayIcon = new NotifyIcon
            {
                Icon = applicationIcon ?? SystemIcons.Application,
                Text = "IT Guardian ativo",
                Visible = true
            };
            remoteAssistance = new RemoteAssistanceTrayController(trayIcon);
        }

        protected override void ExitThreadCore()
        {
            remoteAssistance.Dispose();
            trayIcon.Visible = false;
            trayIcon.Dispose();
            base.ExitThreadCore();
        }
    }
}
