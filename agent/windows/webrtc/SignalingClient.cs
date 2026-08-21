using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ITGuardian.RemoteAssistanceWebRtc
{
    /// <summary>
    /// Fala com os mesmos endpoints REST de sinalizacao ja usados pelo coletor
    /// principal para JPEG (autenticacao por Bearer + X-Remote-Session-Token),
    /// so que restritos a oferta/resposta SDP e a deteccao de fim de sessao.
    /// Nenhum comando de mouse/teclado passa por aqui: isso continua sendo
    /// tratado pelo coletor principal, que roda em paralelo.
    /// </summary>
    internal sealed class SignalingClient : IDisposable
    {
        private readonly HttpClient http;
        private readonly string sessionId;

        public SignalingClient(string serverUrl, string bearerToken, string sessionToken, string sessionId)
        {
            this.sessionId = sessionId;
            http = new HttpClient { BaseAddress = new Uri(serverUrl.TrimEnd('/') + "/") };
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
            http.DefaultRequestHeaders.Add("X-Remote-Session-Token", sessionToken);
            http.Timeout = TimeSpan.FromSeconds(15);
        }

        public async Task<string> WaitForOfferAsync(TimeSpan timeout, CancellationToken cancellationToken)
        {
            DateTime deadline = DateTime.UtcNow.Add(timeout);
            while (DateTime.UtcNow < deadline)
            {
                cancellationToken.ThrowIfCancellationRequested();
                try
                {
                    using (HttpResponseMessage response = await http
                        .GetAsync($"api/agents/remote-assistance/sessions/{sessionId}/webrtc/offer", cancellationToken)
                        .ConfigureAwait(false))
                    {
                        if (response.IsSuccessStatusCode)
                        {
                            string body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                            using JsonDocument doc = JsonDocument.Parse(body);
                            if (doc.RootElement.TryGetProperty("offer", out JsonElement offerElement) &&
                                offerElement.ValueKind == JsonValueKind.String)
                            {
                                string offer = offerElement.GetString();
                                if (!string.IsNullOrWhiteSpace(offer)) return offer;
                            }
                        }
                    }
                }
                catch (HttpRequestException)
                {
                    // Rede instavel: continua tentando ate o prazo esgotar.
                }
                await Task.Delay(500, cancellationToken).ConfigureAwait(false);
            }
            return null;
        }

        public async Task SendAnswerAsync(string sdp, CancellationToken cancellationToken)
        {
            string payload = JsonSerializer.Serialize(new { sdp });
            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            using HttpResponseMessage response = await http
                .PostAsync($"api/agents/remote-assistance/sessions/{sessionId}/webrtc/answer", content, cancellationToken)
                .ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
        }

        /// <summary>
        /// So confere se a sessao ja terminou no servidor (encerrada pelo
        /// tecnico, expirada, etc.) -- nao drena nem aplica nenhum comando,
        /// isso continua sendo responsabilidade do coletor principal.
        /// </summary>
        public async Task<bool> HasSessionEndedAsync(CancellationToken cancellationToken)
        {
            try
            {
                using HttpResponseMessage response = await http
                    .GetAsync($"api/agents/remote-assistance/sessions/{sessionId}/commands", cancellationToken)
                    .ConfigureAwait(false);
                if (!response.IsSuccessStatusCode) return true;
                string body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                using JsonDocument doc = JsonDocument.Parse(body);
                return doc.RootElement.TryGetProperty("ended", out JsonElement endedElement) &&
                       endedElement.ValueKind == JsonValueKind.True;
            }
            catch (HttpRequestException)
            {
                return false;
            }
        }

        public void Dispose()
        {
            http.Dispose();
        }
    }
}
