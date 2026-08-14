using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Pipes;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace ITGuardian.Windows
{
    internal sealed class RemoteAssistancePendingResponse
    {
        public RemoteAssistancePendingSession session { get; set; }
    }

    internal sealed class RemoteAssistancePendingSession
    {
        public string id { get; set; }
        public string technicianName { get; set; }
        public string organizationName { get; set; }
        public string machineName { get; set; }
        public string operatingSystem { get; set; }
        public string reason { get; set; }
        public string requestedMode { get; set; }
        public bool consentRequired { get; set; }
        public bool autoConsent { get; set; }
        public string expiresAt { get; set; }
        public string serviceOrderId { get; set; }
        public string sessionToken { get; set; }
    }

    internal sealed class RemoteAssistanceMonitor
    {
        public string id { get; set; }
        public string name { get; set; }
        public bool primary { get; set; }
        public int width { get; set; }
        public int height { get; set; }
    }

    internal sealed class RemoteAssistanceConsentPayload
    {
        public bool granted { get; set; }
        public bool controlAllowed { get; set; }
        public List<RemoteAssistanceMonitor> monitors { get; set; }
        public string selectedMonitorId { get; set; }
    }

    internal sealed class RemoteAssistanceFramePayload
    {
        public string frame { get; set; }
        public bool unchanged { get; set; }
        public List<RemoteAssistanceMonitor> monitors { get; set; }
        public string selectedMonitorId { get; set; }
    }

    internal sealed class RemoteAssistanceQualityHint
    {
        public int width { get; set; }
        public int height { get; set; }
        public int jpegQuality { get; set; }
        public int captureIntervalMs { get; set; }
    }

    internal sealed class RemoteAssistanceCommandResponse
    {
        public List<RemoteAssistanceCommand> commands { get; set; }
        public string selectedMonitorId { get; set; }
        public bool controlEnabled { get; set; }
        public bool capturePaused { get; set; }
        public RemoteAssistanceQualityHint qualityHint { get; set; }
        public List<RemoteAssistanceChatMessage> chatMessages { get; set; }
        public bool ended { get; set; }
    }

    internal sealed class RemoteAssistanceChatMessage
    {
        public string id { get; set; }
        public string sender { get; set; }
        public string senderName { get; set; }
        public string text { get; set; }
        public string createdAt { get; set; }
    }

    internal sealed class RemoteAssistanceChatPayload
    {
        public string text { get; set; }
    }

    internal sealed class RemoteAssistanceChatSendResponse
    {
        public RemoteAssistanceChatMessage message { get; set; }
    }

    internal sealed class RemoteAssistanceCommand
    {
        public string type { get; set; }
        public double x { get; set; }
        public double y { get; set; }
        public string button { get; set; }
        public string action { get; set; }
        public int delta { get; set; }
        public string key { get; set; }
        public string monitorId { get; set; }
    }

    internal sealed class LocalBrokerRequest
    {
        public string action { get; set; }
        public string sessionId { get; set; }
        public object payload { get; set; }
    }

    internal sealed class LocalBrokerResponse
    {
        public bool ok { get; set; }
        public string error { get; set; }
        public object data { get; set; }
    }

    internal static class RemoteAssistanceEnvironment
    {
        internal const string PipeName = "ITGuardian.RemoteAssistance.v1";

        internal static bool IsAllowed(AgentConfig config)
        {
            if (config == null || !config.enableRemoteAssistance) return false;
            string value = (config.environment ?? "").Trim().ToLowerInvariant();
            return value == "lab" || value == "laboratory" || value == "laboratorio" ||
                value == "homologation" || value == "homologacao" || value == "internal" ||
                value == "interno" || value == "test";
        }
    }

    internal sealed class RemoteAssistanceBroker : IDisposable
    {
        private readonly AgentConfig config;
        private readonly object tokenLock = new object();
        private readonly Dictionary<string, string> sessionTokens = new Dictionary<string, string>();
        private volatile bool stopping;
        private Thread serverThread;

        internal RemoteAssistanceBroker(AgentConfig config)
        {
            this.config = config;
        }

        internal void Start()
        {
            if (!RemoteAssistanceEnvironment.IsAllowed(config)) return;
            serverThread = new Thread(ServerLoop);
            serverThread.IsBackground = true;
            serverThread.Name = "IT Guardian Remote Assistance Broker";
            serverThread.Start();
            Program.WriteLog("INFO", "Canal local de assistencia remota iniciado em ambiente autorizado.");
        }

        private void ServerLoop()
        {
            while (!stopping)
            {
                try
                {
                    using (NamedPipeServerStream pipe = CreatePipe())
                    {
                        pipe.WaitForConnection();
                        if (stopping) return;
                        HandleConnection(pipe);
                    }
                }
                catch (Exception error)
                {
                    if (!stopping)
                    {
                        Program.WriteLog("WARN", "Falha no canal local de assistencia: " + error.Message);
                        Thread.Sleep(1000);
                    }
                }
            }
        }

        private static NamedPipeServerStream CreatePipe()
        {
            PipeSecurity security = new PipeSecurity();
            security.AddAccessRule(new PipeAccessRule(
                new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null),
                PipeAccessRights.FullControl,
                AccessControlType.Allow));
            security.AddAccessRule(new PipeAccessRule(
                new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null),
                PipeAccessRights.FullControl,
                AccessControlType.Allow));
            // Restrito a usuarios com logon interativo (console/RDP), nao a
            // qualquer "Usuario autenticado" do Windows: um logon de rede,
            // de servico ou anonimo nao deve conseguir responder ao
            // consentimento local, injetar chat ou encerrar a sessao no
            // lugar de quem esta de fato na tela. Em uma maquina com mais de
            // uma sessao interativa simultanea (ex.: Terminal Services com
            // varios usuarios logados ao mesmo tempo), este ACL ainda
            // permite qualquer uma dessas sessoes acessar o pipe — restringir
            // exclusivamente ao SID da sessao de console ativa exigiria
            // rastrear o token de logon via WTS/LSA, fora do escopo desta
            // correcao.
            security.AddAccessRule(new PipeAccessRule(
                new SecurityIdentifier(WellKnownSidType.InteractiveSid, null),
                PipeAccessRights.ReadWrite,
                AccessControlType.Allow));
            return new NamedPipeServerStream(
                RemoteAssistanceEnvironment.PipeName,
                PipeDirection.InOut,
                2,
                PipeTransmissionMode.Byte,
                PipeOptions.None,
                1024 * 1024,
                1024 * 1024,
                security);
        }

        private void HandleConnection(Stream pipe)
        {
            StreamReader reader = new StreamReader(pipe, Encoding.UTF8, false, 4096, true);
            StreamWriter writer = new StreamWriter(pipe, new UTF8Encoding(false), 4096, true);
            writer.AutoFlush = true;
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = 2 * 1024 * 1024;
            LocalBrokerResponse response;
            try
            {
                string json = reader.ReadLine();
                LocalBrokerRequest request = serializer.Deserialize<LocalBrokerRequest>(json ?? "{}");
                response = new LocalBrokerResponse { ok = true, data = Dispatch(request, serializer) };
            }
            catch (Exception error)
            {
                response = new LocalBrokerResponse { ok = false, error = SafeError(error) };
            }
            writer.WriteLine(serializer.Serialize(response));
        }

        private object Dispatch(LocalBrokerRequest request, JavaScriptSerializer serializer)
        {
            if (request == null) throw new InvalidOperationException("Solicitacao local invalida.");
            string action = (request.action ?? "").Trim().ToLowerInvariant();
            if (action == "pending") return Pending();
            if (string.IsNullOrWhiteSpace(request.sessionId))
                throw new InvalidOperationException("Sessao local nao informada.");
            if (action == "consent")
                return PostForSession(request.sessionId, "consent", ConvertPayload<RemoteAssistanceConsentPayload>(request.payload, serializer));
            if (action == "frame")
                return PostForSession(request.sessionId, "frame", ConvertPayload<RemoteAssistanceFramePayload>(request.payload, serializer));
            if (action == "commands")
                return GetForSession<RemoteAssistanceCommandResponse>(request.sessionId, "commands");
            if (action == "chat")
                return PostForSession(request.sessionId, "chat", ConvertPayload<RemoteAssistanceChatPayload>(request.payload, serializer));
            if (action == "end")
            {
                object result = PostForSession(request.sessionId, "end", new Dictionary<string, object>());
                lock (tokenLock) sessionTokens.Remove(request.sessionId);
                return result;
            }
            throw new InvalidOperationException("Acao local nao permitida.");
        }

        private object Pending()
        {
            RemoteAssistancePendingResponse response = Send<RemoteAssistancePendingResponse>(
                "GET", "/api/agents/remote-assistance/pending", null, null);
            if (response == null || response.session == null) return null;
            RemoteAssistancePendingSession session = response.session;
            if (string.IsNullOrWhiteSpace(session.id) || string.IsNullOrWhiteSpace(session.sessionToken))
                throw new InvalidOperationException("Solicitacao remota incompleta.");
            lock (tokenLock) sessionTokens[session.id] = session.sessionToken;
            session.sessionToken = null;
            return session;
        }

        private T ConvertPayload<T>(object payload, JavaScriptSerializer serializer)
        {
            return serializer.Deserialize<T>(serializer.Serialize(payload));
        }

        private object PostForSession(string sessionId, string action, object payload)
        {
            return Send<object>(
                "POST",
                "/api/agents/remote-assistance/sessions/" + Uri.EscapeDataString(sessionId) + "/" + action,
                TokenFor(sessionId),
                payload);
        }

        private T GetForSession<T>(string sessionId, string action)
        {
            return Send<T>(
                "GET",
                "/api/agents/remote-assistance/sessions/" + Uri.EscapeDataString(sessionId) + "/" + action,
                TokenFor(sessionId),
                null);
        }

        private string TokenFor(string sessionId)
        {
            lock (tokenLock)
            {
                string token;
                if (sessionTokens.TryGetValue(sessionId, out token)) return token;
            }
            throw new InvalidOperationException("A autorizacao efemera desta sessao nao esta disponivel.");
        }

        private T Send<T>(string method, string path, string sessionToken, object payload)
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(config.serverUrl.TrimEnd('/') + path);
            request.Method = method;
            request.Accept = "application/json";
            request.ContentType = "application/json";
            request.Headers[HttpRequestHeader.Authorization] = "Bearer " + config.agentToken;
            if (!string.IsNullOrWhiteSpace(sessionToken))
                request.Headers["X-Remote-Session-Token"] = sessionToken;
            request.Timeout = 15000;
            request.ReadWriteTimeout = 15000;
            if (payload != null)
            {
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                serializer.MaxJsonLength = 2 * 1024 * 1024;
                byte[] body = Encoding.UTF8.GetBytes(serializer.Serialize(payload));
                request.ContentLength = body.Length;
                using (Stream stream = request.GetRequestStream()) stream.Write(body, 0, body.Length);
            }
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
            {
                string json = reader.ReadToEnd();
                if (typeof(T) == typeof(object))
                    return (T)(object)new JavaScriptSerializer().DeserializeObject(json);
                return new JavaScriptSerializer().Deserialize<T>(json);
            }
        }

        private static string SafeError(Exception error)
        {
            WebException webError = error as WebException;
            HttpWebResponse response = webError == null ? null : webError.Response as HttpWebResponse;
            if (response != null)
                return "O servidor recusou a operacao de assistencia (HTTP " + (int)response.StatusCode + ").";
            return "A operacao de assistencia nao pode ser concluida.";
        }

        public void Dispose()
        {
            stopping = true;
            try
            {
                using (NamedPipeClientStream wake = new NamedPipeClientStream(
                    ".", RemoteAssistanceEnvironment.PipeName, PipeDirection.Out))
                {
                    wake.Connect(250);
                }
            }
            catch { }
        }
    }

    internal static class LocalRemoteAssistanceClient
    {
        internal static T Call<T>(string action, string sessionId, object payload)
        {
            using (NamedPipeClientStream pipe = new NamedPipeClientStream(
                ".", RemoteAssistanceEnvironment.PipeName, PipeDirection.InOut))
            {
                pipe.Connect(1000);
                pipe.ReadMode = PipeTransmissionMode.Byte;
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                serializer.MaxJsonLength = 2 * 1024 * 1024;
                StreamWriter writer = new StreamWriter(pipe, new UTF8Encoding(false), 4096, true);
                writer.AutoFlush = true;
                writer.WriteLine(serializer.Serialize(new LocalBrokerRequest
                {
                    action = action,
                    sessionId = sessionId,
                    payload = payload
                }));
                StreamReader reader = new StreamReader(pipe, Encoding.UTF8, false, 4096, true);
                LocalBrokerResponse response = serializer.Deserialize<LocalBrokerResponse>(reader.ReadLine() ?? "{}");
                if (response == null || !response.ok)
                    throw new InvalidOperationException(response == null ? "Canal local indisponivel." : response.error);
                if (response.data == null) return default(T);
                return serializer.Deserialize<T>(serializer.Serialize(response.data));
            }
        }
    }

    internal sealed class RemoteAssistanceConsentForm : Form
    {
        private readonly CheckBox controlCheckBox;
        internal bool ControlAllowed { get { return controlCheckBox.Checked; } }

        internal RemoteAssistanceConsentForm(RemoteAssistancePendingSession session)
        {
            Text = "Assistencia remota - IT Guardian";
            Width = 520;
            Height = 430;
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            TopMost = true;
            ShowInTaskbar = true;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.Padding = new Padding(24);
            layout.ColumnCount = 1;
            layout.RowCount = 9;
            layout.AutoSize = true;
            Controls.Add(layout);

            Label title = new Label();
            title.Text = "Solicitacao de assistencia remota";
            title.Font = new Font(Font, FontStyle.Bold);
            title.AutoSize = true;
            layout.Controls.Add(title);
            layout.Controls.Add(Detail("Tecnico", session.technicianName));
            layout.Controls.Add(Detail("Organizacao", session.organizationName));
            layout.Controls.Add(Detail("Computador", session.machineName));
            layout.Controls.Add(Detail("Sistema", session.operatingSystem));
            layout.Controls.Add(Detail("Motivo", session.reason));

            Label warning = new Label();
            warning.Text = "Sua tela sera compartilhada. Nenhum arquivo, senha, area de transferencia ou audio sera coletado.";
            warning.AutoSize = true;
            warning.MaximumSize = new Size(450, 0);
            warning.ForeColor = Color.FromArgb(130, 72, 0);
            layout.Controls.Add(warning);

            controlCheckBox = new CheckBox();
            controlCheckBox.Text = "Permitir tambem mouse e teclado durante esta sessao";
            controlCheckBox.AutoSize = true;
            controlCheckBox.Visible = string.Equals(session.requestedMode, "control", StringComparison.OrdinalIgnoreCase);
            layout.Controls.Add(controlCheckBox);

            FlowLayoutPanel actions = new FlowLayoutPanel();
            actions.FlowDirection = FlowDirection.RightToLeft;
            actions.Dock = DockStyle.Fill;
            Button authorize = new Button();
            authorize.Text = "Autorizar";
            authorize.DialogResult = DialogResult.OK;
            authorize.AutoSize = true;
            Button deny = new Button();
            deny.Text = "Negar";
            deny.DialogResult = DialogResult.Cancel;
            deny.AutoSize = true;
            actions.Controls.Add(authorize);
            actions.Controls.Add(deny);
            layout.Controls.Add(actions);
            AcceptButton = authorize;
            CancelButton = deny;
        }

        private static Control Detail(string label, string value)
        {
            Label detail = new Label();
            detail.Text = label + ": " + (string.IsNullOrWhiteSpace(value) ? "Nao informado" : value);
            detail.AutoSize = true;
            detail.MaximumSize = new Size(450, 0);
            return detail;
        }
    }

    internal sealed class RemoteAssistanceIndicatorForm : Form
    {
        internal event EventHandler EndRequested;
        internal event EventHandler ChatRequested;

        internal RemoteAssistanceIndicatorForm(string technicianName, bool controlRequested)
        {
            Text = "IT Guardian";
            Width = 460;
            Height = 92;
            FormBorderStyle = FormBorderStyle.FixedToolWindow;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            ShowInTaskbar = true;
            ControlBox = false;
            BackColor = Color.FromArgb(236, 250, 246);

            Label label = new Label();
            label.Text = (controlRequested ? "Controle remoto" : "Tela compartilhada") +
                " com " + (technicianName ?? "tecnico");
            label.AutoSize = true;
            label.Location = new Point(16, 18);
            label.Font = new Font(Font, FontStyle.Bold);
            Controls.Add(label);

            Button chat = new Button();
            chat.Text = "Chat";
            chat.AutoSize = true;
            chat.Location = new Point(278, 13);
            chat.Click += delegate(object sender, EventArgs args)
            {
                EventHandler handler = ChatRequested;
                if (handler != null) handler(this, EventArgs.Empty);
            };
            Controls.Add(chat);

            Button end = new Button();
            end.Text = "Encerrar";
            end.AutoSize = true;
            end.Location = new Point(358, 13);
            end.Click += delegate(object sender, EventArgs args)
            {
                EventHandler handler = EndRequested;
                if (handler != null) handler(this, EventArgs.Empty);
            };
            Controls.Add(end);
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            Rectangle area = Screen.PrimaryScreen.WorkingArea;
            Location = new Point(area.Right - Width - 16, area.Top + 16);
        }
    }

    internal delegate void ChatMessageSubmittedHandler(string text);

    /// <summary>
    /// Janela de chat local da sessao. Mensagens existem apenas enquanto a
    /// sessao dura (mesmo canal efemero do relay no servidor) - nada e salvo
    /// em disco pelo agente.
    /// </summary>
    internal sealed class RemoteAssistanceChatForm : Form
    {
        internal event ChatMessageSubmittedHandler MessageSubmitted;
        private readonly TextBox log;
        private readonly TextBox input;

        internal RemoteAssistanceChatForm(string technicianName)
        {
            Text = "Chat - IT Guardian";
            Width = 380;
            Height = 420;
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = true;
            TopMost = true;
            ShowInTaskbar = true;

            TableLayoutPanel layout = new TableLayoutPanel();
            layout.Dock = DockStyle.Fill;
            layout.Padding = new Padding(12);
            layout.ColumnCount = 1;
            layout.RowCount = 3;
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            Controls.Add(layout);

            log = new TextBox();
            log.Multiline = true;
            log.ReadOnly = true;
            log.ScrollBars = ScrollBars.Vertical;
            log.Dock = DockStyle.Fill;
            log.BackColor = Color.White;
            layout.Controls.Add(log);

            FlowLayoutPanel inputRow = new FlowLayoutPanel();
            inputRow.Dock = DockStyle.Fill;
            inputRow.WrapContents = false;
            input = new TextBox();
            input.Width = 240;
            input.MaxLength = 2000;
            input.KeyDown += delegate(object sender, KeyEventArgs args)
            {
                if (args.KeyCode == Keys.Enter)
                {
                    args.SuppressKeyPress = true;
                    Submit();
                }
            };
            Button send = new Button();
            send.Text = "Enviar";
            send.AutoSize = true;
            send.Click += delegate { Submit(); };
            inputRow.Controls.Add(input);
            inputRow.Controls.Add(send);
            layout.Controls.Add(inputRow);

            Label hint = new Label();
            hint.Text = "Visivel apenas durante esta sessao, com " + (technicianName ?? "o tecnico") + ".";
            hint.AutoSize = true;
            hint.ForeColor = Color.Gray;
            layout.Controls.Add(hint);
        }

        private void Submit()
        {
            string text = input.Text.Trim();
            if (text.Length == 0) return;
            input.Text = "";
            ChatMessageSubmittedHandler handler = MessageSubmitted;
            if (handler != null) handler(text);
        }

        internal void SeedMessages(IEnumerable<RemoteAssistanceChatMessage> messages)
        {
            foreach (RemoteAssistanceChatMessage message in messages) AppendLine(message);
        }

        internal void AppendMessages(IEnumerable<RemoteAssistanceChatMessage> messages)
        {
            foreach (RemoteAssistanceChatMessage message in messages) AppendLine(message);
        }

        internal void ShowError(string message)
        {
            log.AppendText("[erro] " + message + Environment.NewLine);
        }

        private void AppendLine(RemoteAssistanceChatMessage message)
        {
            if (message == null) return;
            string who = message.sender == "technician" ? (message.senderName ?? "Tecnico") : "Voce";
            log.AppendText(who + ": " + message.text + Environment.NewLine);
        }
    }

    internal sealed class RemoteAssistanceTrayController : IDisposable
    {
        private const int MinCaptureIntervalMs = 150;
        private const int MaxCaptureIntervalMs = 3000;
        private const int MinJpegQualityValue = 10;
        private const int MaxJpegQualityValue = 95;
        private const int MinCaptureWidth = 320;
        private const int MaxCaptureWidth = 1920;
        private const int DefaultCaptureIntervalMs = 1000;
        private const int DefaultJpegQuality = 55;

        private readonly NotifyIcon trayIcon;
        private readonly SynchronizationContext uiContext;
        private readonly System.Windows.Forms.Timer pendingTimer;
        private volatile bool polling;
        private volatile bool streaming;
        private volatile bool capturePaused;
        private string activeSessionId;
        private string selectedMonitorId;
        private string technicianName;
        private string lastFrameHash;
        private RemoteAssistanceQualityHint qualityHint;
        private Thread streamingThread;
        private RemoteAssistanceIndicatorForm indicator;
        private RemoteAssistanceChatForm chatForm;
        private readonly object chatLock = new object();
        private readonly HashSet<string> seenChatMessageIds = new HashSet<string>();
        private readonly List<RemoteAssistanceChatMessage> chatHistory = new List<RemoteAssistanceChatMessage>();

        internal RemoteAssistanceTrayController(NotifyIcon trayIcon)
        {
            this.trayIcon = trayIcon;
            uiContext = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
            pendingTimer = new System.Windows.Forms.Timer();
            pendingTimer.Interval = 2500;
            pendingTimer.Tick += delegate { PollPending(); };
            pendingTimer.Start();
        }

        private void PollPending()
        {
            if (polling || streaming || !string.IsNullOrWhiteSpace(activeSessionId)) return;
            polling = true;
            ThreadPool.QueueUserWorkItem(delegate
            {
                RemoteAssistancePendingSession pending = null;
                try { pending = LocalRemoteAssistanceClient.Call<RemoteAssistancePendingSession>("pending", null, null); }
                catch { }
                uiContext.Post(delegate(object state)
                {
                    polling = false;
                    if (pending != null) HandlePending(pending);
                }, null);
            });
        }

        private void HandlePending(RemoteAssistancePendingSession session)
        {
            if (streaming || !string.IsNullOrWhiteSpace(activeSessionId)) return;
            bool granted;
            bool controlAllowed = false;
            if (session.autoConsent && !session.consentRequired)
            {
                granted = true;
                controlAllowed = string.Equals(session.requestedMode, "control", StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                using (RemoteAssistanceConsentForm form = new RemoteAssistanceConsentForm(session))
                {
                    granted = form.ShowDialog() == DialogResult.OK;
                    controlAllowed = granted && form.ControlAllowed;
                }
            }
            SendConsent(session, granted, controlAllowed);
        }

        private void SendConsent(RemoteAssistancePendingSession session, bool granted, bool controlAllowed)
        {
            List<RemoteAssistanceMonitor> monitors = ScreenMonitors();
            string primary = monitors.Count == 0 ? null : monitors[0].id;
            try
            {
                LocalRemoteAssistanceClient.Call<object>("consent", session.id, new RemoteAssistanceConsentPayload
                {
                    granted = granted,
                    controlAllowed = controlAllowed,
                    monitors = monitors,
                    selectedMonitorId = primary
                });
            }
            catch
            {
                MessageBox.Show(
                    "Nao foi possivel responder a solicitacao. Tente novamente pelo IT Guardian.",
                    "IT Guardian",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }
            if (!granted) return;
            activeSessionId = session.id;
            selectedMonitorId = primary;
            technicianName = session.technicianName;
            ShowIndicator(session.technicianName, controlAllowed);
            StartStreaming();
        }

        private void ShowIndicator(string technicianName, bool controlAllowed)
        {
            trayIcon.Text = "IT Guardian - assistencia remota ativa";
            indicator = new RemoteAssistanceIndicatorForm(technicianName, controlAllowed);
            indicator.EndRequested += delegate { EndLocally(); };
            indicator.ChatRequested += delegate { ToggleChatWindow(); };
            indicator.Show();
        }

        private void ToggleChatWindow()
        {
            if (chatForm != null)
            {
                if (!chatForm.Visible) chatForm.Show();
                chatForm.Activate();
                return;
            }
            chatForm = new RemoteAssistanceChatForm(technicianName);
            chatForm.MessageSubmitted += delegate(string text) { SendChatMessage(text); };
            chatForm.FormClosed += delegate { chatForm = null; };
            lock (chatLock) { chatForm.SeedMessages(new List<RemoteAssistanceChatMessage>(chatHistory)); }
            chatForm.Show();
        }

        private void SendChatMessage(string text)
        {
            string sessionId = activeSessionId;
            if (string.IsNullOrWhiteSpace(sessionId) || string.IsNullOrWhiteSpace(text)) return;
            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    RemoteAssistanceChatSendResponse response = LocalRemoteAssistanceClient.Call<RemoteAssistanceChatSendResponse>(
                        "chat", sessionId, new RemoteAssistanceChatPayload { text = text });
                    if (response != null && response.message != null)
                    {
                        List<RemoteAssistanceChatMessage> single = new List<RemoteAssistanceChatMessage> { response.message };
                        uiContext.Post(delegate { AppendChatMessages(single); }, null);
                    }
                }
                catch
                {
                    uiContext.Post(delegate
                    {
                        if (chatForm != null) chatForm.ShowError("Nao foi possivel enviar a mensagem.");
                    }, null);
                }
            });
        }

        private void ProcessChatMessages(List<RemoteAssistanceChatMessage> messages)
        {
            if (messages == null || messages.Count == 0) return;
            List<RemoteAssistanceChatMessage> fresh = new List<RemoteAssistanceChatMessage>();
            lock (chatLock)
            {
                foreach (RemoteAssistanceChatMessage message in messages)
                {
                    if (message == null || string.IsNullOrEmpty(message.id)) continue;
                    if (seenChatMessageIds.Add(message.id)) fresh.Add(message);
                }
            }
            if (fresh.Count == 0) return;
            uiContext.Post(delegate { AppendChatMessages(fresh); }, null);
        }

        private void AppendChatMessages(List<RemoteAssistanceChatMessage> fresh)
        {
            lock (chatLock)
            {
                chatHistory.AddRange(fresh);
                if (chatHistory.Count > 200) chatHistory.RemoveRange(0, chatHistory.Count - 200);
            }
            if (chatForm != null) chatForm.AppendMessages(fresh);
        }

        private void StartStreaming()
        {
            lastFrameHash = null;
            qualityHint = null;
            capturePaused = false;
            streaming = true;
            streamingThread = new Thread(StreamLoop);
            streamingThread.IsBackground = true;
            streamingThread.Name = "IT Guardian Remote Assistance Session";
            streamingThread.Start();
        }

        private static int Clamp(int value, int min, int max)
        {
            if (value < min) return min;
            if (value > max) return max;
            return value;
        }

        private void StreamLoop()
        {
            int consecutiveFailures = 0;
            while (streaming && !string.IsNullOrWhiteSpace(activeSessionId))
            {
                int sleepMs = DefaultCaptureIntervalMs;
                try
                {
                    RemoteAssistanceCommandResponse commands =
                        LocalRemoteAssistanceClient.Call<RemoteAssistanceCommandResponse>(
                            "commands", activeSessionId, null);
                    if (commands == null || commands.ended)
                    {
                        StopOnUiThread();
                        return;
                    }
                    string previousMonitorId = selectedMonitorId;
                    if (!string.IsNullOrWhiteSpace(commands.selectedMonitorId))
                        selectedMonitorId = commands.selectedMonitorId;
                    ApplyCommands(commands);
                    if (selectedMonitorId != previousMonitorId) lastFrameHash = null;

                    qualityHint = commands.qualityHint;
                    capturePaused = commands.capturePaused;
                    ProcessChatMessages(commands.chatMessages);
                    sleepMs = Clamp(
                        qualityHint != null ? qualityHint.captureIntervalMs : DefaultCaptureIntervalMs,
                        MinCaptureIntervalMs,
                        MaxCaptureIntervalMs);

                    if (!capturePaused) CaptureAndSendFrame();
                    consecutiveFailures = 0;
                }
                catch
                {
                    consecutiveFailures++;
                    if (consecutiveFailures >= 8)
                    {
                        StopOnUiThread();
                        return;
                    }
                }
                Thread.Sleep(capturePaused ? Math.Min(sleepMs * 2, MaxCaptureIntervalMs) : sleepMs);
            }
        }

        /// <summary>
        /// Falha de captura (tela bloqueada, monitor removido, erro de GDI) nunca
        /// deve encerrar a sessao: apenas pula o quadro desta rodada.
        /// </summary>
        private void CaptureAndSendFrame()
        {
            int targetWidth = MaxCaptureWidth;
            int jpegQuality = DefaultJpegQuality;
            if (qualityHint != null)
            {
                targetWidth = Clamp(qualityHint.width, MinCaptureWidth, MaxCaptureWidth);
                jpegQuality = Clamp(qualityHint.jpegQuality, MinJpegQualityValue, MaxJpegQualityValue);
            }

            string frame;
            try
            {
                frame = CaptureSelectedMonitor(selectedMonitorId, targetWidth, jpegQuality);
            }
            catch (Exception captureError)
            {
                Program.WriteLog("WARN", "Falha ao capturar tela para assistencia remota: " + captureError.Message);
                return;
            }
            if (string.IsNullOrWhiteSpace(frame)) return;

            string hash = ComputeFrameHash(frame);
            bool unchanged = lastFrameHash != null && hash == lastFrameHash;
            LocalRemoteAssistanceClient.Call<object>("frame", activeSessionId, new RemoteAssistanceFramePayload
            {
                frame = unchanged ? null : frame,
                unchanged = unchanged,
                monitors = ScreenMonitors(),
                selectedMonitorId = selectedMonitorId
            });
            lastFrameHash = hash;
        }

        private static string ComputeFrameHash(string frame)
        {
            using (MD5 md5 = MD5.Create())
            {
                byte[] hash = md5.ComputeHash(Encoding.UTF8.GetBytes(frame));
                StringBuilder builder = new StringBuilder(hash.Length * 2);
                for (int i = 0; i < hash.Length; i++) builder.Append(hash[i].ToString("x2"));
                return builder.ToString();
            }
        }

        private void ApplyCommands(RemoteAssistanceCommandResponse response)
        {
            if (response.commands == null) return;
            foreach (RemoteAssistanceCommand command in response.commands)
            {
                if (command == null) continue;
                if (command.type == "select_monitor")
                {
                    selectedMonitorId = command.monitorId;
                    continue;
                }
                if (response.controlEnabled) RemoteInput.Apply(command, selectedMonitorId);
            }
        }

        private void EndLocally()
        {
            string sessionId = activeSessionId;
            streaming = false;
            if (!string.IsNullOrWhiteSpace(sessionId))
            {
                ThreadPool.QueueUserWorkItem(delegate
                {
                    try { LocalRemoteAssistanceClient.Call<object>("end", sessionId, null); }
                    catch { }
                });
            }
            ResetUi();
        }

        private void StopOnUiThread()
        {
            uiContext.Post(delegate { streaming = false; ResetUi(); }, null);
        }

        private void ResetUi()
        {
            activeSessionId = null;
            selectedMonitorId = null;
            technicianName = null;
            lastFrameHash = null;
            qualityHint = null;
            capturePaused = false;
            trayIcon.Text = "IT Guardian ativo";
            if (indicator != null)
            {
                indicator.Close();
                indicator.Dispose();
                indicator = null;
            }
            if (chatForm != null)
            {
                RemoteAssistanceChatForm form = chatForm;
                chatForm = null;
                form.Close();
                form.Dispose();
            }
            lock (chatLock)
            {
                seenChatMessageIds.Clear();
                chatHistory.Clear();
            }
        }

        private static List<RemoteAssistanceMonitor> ScreenMonitors()
        {
            List<RemoteAssistanceMonitor> monitors = new List<RemoteAssistanceMonitor>();
            Screen[] screens = Screen.AllScreens;
            for (int index = 0; index < screens.Length; index++)
            {
                Screen screen = screens[index];
                monitors.Add(new RemoteAssistanceMonitor
                {
                    id = "screen-" + index,
                    name = "Monitor " + (index + 1),
                    primary = screen.Primary,
                    width = screen.Bounds.Width,
                    height = screen.Bounds.Height
                });
            }
            monitors.Sort(delegate(RemoteAssistanceMonitor left, RemoteAssistanceMonitor right)
            {
                return right.primary.CompareTo(left.primary);
            });
            return monitors;
        }

        private static Screen FindScreen(string id)
        {
            int index;
            if (!string.IsNullOrWhiteSpace(id) && id.StartsWith("screen-") &&
                int.TryParse(id.Substring(7), out index) && index >= 0 && index < Screen.AllScreens.Length)
                return Screen.AllScreens[index];
            return Screen.PrimaryScreen;
        }

        private static string CaptureSelectedMonitor(string monitorId, int maxWidth, int jpegQuality)
        {
            Screen screen = FindScreen(monitorId);
            if (screen == null) return null;
            Rectangle bounds = screen.Bounds;
            int targetWidth = Math.Min(maxWidth, bounds.Width);
            int targetHeight = Math.Max(1, (int)Math.Round(bounds.Height * (targetWidth / (double)bounds.Width)));
            using (Bitmap source = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format24bppRgb))
            using (Graphics sourceGraphics = Graphics.FromImage(source))
            using (Bitmap target = new Bitmap(targetWidth, targetHeight, PixelFormat.Format24bppRgb))
            using (Graphics targetGraphics = Graphics.FromImage(target))
            using (MemoryStream stream = new MemoryStream())
            {
                sourceGraphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size, CopyPixelOperation.SourceCopy);
                targetGraphics.DrawImage(source, new Rectangle(0, 0, targetWidth, targetHeight));
                ImageCodecInfo codec = FindJpegCodec();
                EncoderParameters parameters = new EncoderParameters(1);
                parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)jpegQuality);
                target.Save(stream, codec, parameters);
                return "data:image/jpeg;base64," + Convert.ToBase64String(stream.ToArray());
            }
        }

        private static ImageCodecInfo FindJpegCodec()
        {
            foreach (ImageCodecInfo codec in ImageCodecInfo.GetImageEncoders())
                if (codec.FormatID == ImageFormat.Jpeg.Guid) return codec;
            throw new InvalidOperationException("Codec JPEG indisponivel.");
        }

        public void Dispose()
        {
            pendingTimer.Stop();
            pendingTimer.Dispose();
            EndLocally();
        }
    }

    internal static class RemoteInput
    {
        private const uint MouseLeftDown = 0x0002;
        private const uint MouseLeftUp = 0x0004;
        private const uint MouseRightDown = 0x0008;
        private const uint MouseRightUp = 0x0010;
        private const uint MouseMiddleDown = 0x0020;
        private const uint MouseMiddleUp = 0x0040;
        private const uint MouseWheel = 0x0800;
        private const uint KeyUp = 0x0002;

        [DllImport("user32.dll")]
        private static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")]
        private static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extraInfo);
        [DllImport("user32.dll")]
        private static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
        [DllImport("user32.dll")]
        private static extern short VkKeyScan(char character);

        internal static void Apply(RemoteAssistanceCommand command, string monitorId)
        {
            if (command.type == "mouse_move")
            {
                Screen screen = ScreenFromId(monitorId);
                int x = screen.Bounds.Left + (int)Math.Round(command.x * (screen.Bounds.Width - 1));
                int y = screen.Bounds.Top + (int)Math.Round(command.y * (screen.Bounds.Height - 1));
                SetCursorPos(x, y);
            }
            else if (command.type == "mouse_button") ApplyMouseButton(command.button, command.action);
            else if (command.type == "mouse_wheel") mouse_event(MouseWheel, 0, 0, command.delta, UIntPtr.Zero);
            else if (command.type == "key") ApplyKey(command.key, command.action);
        }

        private static Screen ScreenFromId(string id)
        {
            int index;
            if (!string.IsNullOrWhiteSpace(id) && id.StartsWith("screen-") &&
                int.TryParse(id.Substring(7), out index) && index >= 0 && index < Screen.AllScreens.Length)
                return Screen.AllScreens[index];
            return Screen.PrimaryScreen;
        }

        private static void ApplyMouseButton(string button, string action)
        {
            uint down = button == "right" ? MouseRightDown : button == "middle" ? MouseMiddleDown : MouseLeftDown;
            uint up = button == "right" ? MouseRightUp : button == "middle" ? MouseMiddleUp : MouseLeftUp;
            if (action == "down" || action == "click") mouse_event(down, 0, 0, 0, UIntPtr.Zero);
            if (action == "up" || action == "click") mouse_event(up, 0, 0, 0, UIntPtr.Zero);
        }

        private static void ApplyKey(string key, string action)
        {
            byte virtualKey = VirtualKey(key);
            if (virtualKey == 0) return;
            if (action == "down" || action == "press") keybd_event(virtualKey, 0, 0, UIntPtr.Zero);
            if (action == "up" || action == "press") keybd_event(virtualKey, 0, KeyUp, UIntPtr.Zero);
        }

        private static byte VirtualKey(string key)
        {
            if (string.IsNullOrEmpty(key)) return 0;
            Dictionary<string, byte> named = new Dictionary<string, byte>(StringComparer.OrdinalIgnoreCase)
            {
                { "Enter", 0x0D }, { "Escape", 0x1B }, { "Backspace", 0x08 }, { "Tab", 0x09 },
                { "Delete", 0x2E }, { "Insert", 0x2D }, { "Home", 0x24 }, { "End", 0x23 },
                { "PageUp", 0x21 }, { "PageDown", 0x22 }, { "ArrowUp", 0x26 },
                { "ArrowDown", 0x28 }, { "ArrowLeft", 0x25 }, { "ArrowRight", 0x27 },
                { "Space", 0x20 }
            };
            byte value;
            if (named.TryGetValue(key, out value)) return value;
            if (key.Length == 1) return (byte)(VkKeyScan(key[0]) & 0xff);
            return 0;
        }
    }
}
