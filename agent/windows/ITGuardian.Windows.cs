using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Management;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("IT Guardian")]
[assembly: System.Reflection.AssemblyDescription("Inventario e presenca do IT Guardian")]
[assembly: System.Reflection.AssemblyCompany("IT Guardian")]
[assembly: System.Reflection.AssemblyProduct("IT Guardian")]
[assembly: System.Reflection.AssemblyVersion("1.2.0.0")]
[assembly: System.Reflection.AssemblyFileVersion("1.2.0.0")]

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
    }

    internal static class Program
    {
        private const string AgentVersion = "1.2.0";

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
            do
            {
                try
                {
                    SendInventory(config);
                }
                catch (Exception error)
                {
                    WriteLog("ERROR", error.Message);
                    if (runOnce) throw;
                }

                if (!runOnce) Thread.Sleep(TimeSpan.FromSeconds(config.intervalSeconds));
            }
            while (!runOnce);
        }

        private static void SendInventory(AgentConfig config)
        {
            Dictionary<string, object> payload = CollectInventory(config);
            string endpoint = config.serverUrl.TrimEnd('/') + "/api/agents/heartbeat";
            byte[] body = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(payload));
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
                    throw new InvalidOperationException("Heartbeat recusado pelo servidor.");
                }
            }
            WriteLog("INFO", "Inventario real enviado para " + config.serverUrl + ".");
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
            if (config.includeLoggedUser) payload["loggedUser"] = Environment.UserName;
            return payload;
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
    }

    internal sealed class TrayApplicationContext : ApplicationContext
    {
        private readonly NotifyIcon trayIcon;

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
        }

        protected override void ExitThreadCore()
        {
            trayIcon.Visible = false;
            trayIcon.Dispose();
            base.ExitThreadCore();
        }
    }
}
