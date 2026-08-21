using System.Collections.Generic;

namespace ITGuardian.RemoteAssistanceWebRtc
{
    internal sealed class WebRtcSessionParameters
    {
        public string ServerUrl { get; set; }
        public string SessionId { get; set; }
        public string BearerToken { get; set; }
        public string SessionToken { get; set; }
        public string MonitorId { get; set; }
        public int CaptureIntervalMs { get; set; } = 100;
        public List<IceServerParameters> IceServers { get; set; }
    }

    internal sealed class IceServerParameters
    {
        public string Urls { get; set; }
        public string Username { get; set; }
        public string Credential { get; set; }
    }
}
