using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using SIPSorcery.Media;
using SIPSorcery.Net;
using SIPSorceryMedia.Abstractions;
using SIPSorceryMedia.Encoders;

namespace ITGuardian.RemoteAssistanceWebRtc
{
    internal sealed class WebRtcAgentSession : IDisposable
    {
        private readonly WebRtcSessionParameters parameters;
        private readonly SignalingClient signaling;
        private RTCPeerConnection peerConnection;
        private VideoEncoderEndPoint videoSource;
        private volatile bool connected;
        private volatile bool stopping;

        public WebRtcAgentSession(WebRtcSessionParameters parameters)
        {
            this.parameters = parameters;
            signaling = new SignalingClient(parameters.ServerUrl, parameters.BearerToken, parameters.SessionToken, parameters.SessionId);
        }

        public async Task<int> RunAsync(CancellationToken cancellationToken)
        {
            // O servidor marca a sessao como "agent_timeout" se last_seen_at
            // ficar velho demais (config.agentTimeoutSeconds, ~45s por
            // padrao). No caminho JPEG isso e mantido fresco a cada frame
            // postado; aqui, nada toca a sessao ate a transmissao comecar de
            // verdade -- e negociar oferta/resposta/ICE/DTLS pode legitimamente
            // levar mais do que isso numa rede ruim. Por isso mantemos a
            // sessao viva desde o primeiro instante, reaproveitando o polling
            // de "commands" (que ja tem esse efeito colateral no servidor)
            // como um keep-alive independente do estado da conexao.
            using CancellationTokenSource keepAliveCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            Task keepAliveTask = KeepSessionAliveAsync(keepAliveCts.Token);
            try
            {
                return await RunNegotiationAsync(cancellationToken).ConfigureAwait(false);
            }
            finally
            {
                keepAliveCts.Cancel();
                try { await keepAliveTask.ConfigureAwait(false); } catch (OperationCanceledException) { }
            }
        }

        private async Task KeepSessionAliveAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try { await Task.Delay(10000, cancellationToken).ConfigureAwait(false); }
                catch (OperationCanceledException) { return; }
                if (cancellationToken.IsCancellationRequested) return;
                await signaling.HasSessionEndedAsync(cancellationToken).ConfigureAwait(false);
            }
        }

        private async Task<int> RunNegotiationAsync(CancellationToken cancellationToken)
        {
            Console.WriteLine("Aguardando oferta SDP do visualizador...");
            string offerSdp = await signaling.WaitForOfferAsync(TimeSpan.FromSeconds(30), cancellationToken).ConfigureAwait(false);
            if (offerSdp == null)
            {
                Console.Error.WriteLine("Nenhuma oferta SDP recebida dentro do prazo.");
                return 2;
            }

            RTCConfiguration config = new RTCConfiguration { iceServers = BuildIceServers() };
            peerConnection = new RTCPeerConnection(config);

            videoSource = new VideoEncoderEndPoint();
            // VideoEncoderEndPoint.GetVideoSourceFormats() vem hardcoded em
            // H263 por padrao nesta versao do pacote (confirmado testando ao
            // vivo: nem RestrictFormats nem SetVideoSourceFormat mudam o que
            // ele devolve). Por isso construimos a lista de formatos do track
            // manualmente com VP8 -- o unico codec que o VpxVideoEncoder deste
            // pacote sabe codificar -- em vez de confiar no que o endpoint
            // relata sobre si mesmo.
            VideoFormat vp8Format = new VideoFormat(VideoCodecsEnum.VP8, 96, 90000);
            videoSource.SetVideoSourceFormat(vp8Format);
            List<VideoFormat> sourceFormats = new List<VideoFormat> { vp8Format };
            MediaStreamTrack videoTrack = new MediaStreamTrack(sourceFormats, MediaStreamStatusEnum.SendOnly);
            peerConnection.addTrack(videoTrack);
            videoSource.OnVideoSourceEncodedSample += peerConnection.SendVideo;

            var connectedTcs = new TaskCompletionSource<bool>();
            peerConnection.onconnectionstatechange += state =>
            {
                Console.WriteLine("Estado da conexao: " + state);
                if (state == RTCPeerConnectionState.connected)
                {
                    connected = true;
                    connectedTcs.TrySetResult(true);
                }
                else if (state == RTCPeerConnectionState.failed || state == RTCPeerConnectionState.closed)
                {
                    connected = false;
                    connectedTcs.TrySetResult(false);
                }
            };

            SetDescriptionResultEnum setOfferResult = peerConnection.setRemoteDescription(
                new RTCSessionDescriptionInit { type = RTCSdpType.offer, sdp = offerSdp });
            if (setOfferResult != SetDescriptionResultEnum.OK)
            {
                Console.Error.WriteLine("Falha ao aplicar a oferta SDP: " + setOfferResult);
                return 3;
            }

            RTCSessionDescriptionInit answer = peerConnection.createAnswer(null);
            await peerConnection.setLocalDescription(answer).ConfigureAwait(false);

            await WaitForIceGatheringCompleteAsync(TimeSpan.FromSeconds(10), cancellationToken).ConfigureAwait(false);

            string localSdp = peerConnection.localDescription.sdp.ToString();
            await signaling.SendAnswerAsync(localSdp, cancellationToken).ConfigureAwait(false);
            Console.WriteLine("Resposta SDP enviada. Aguardando conexao ICE/DTLS...");

            using (cancellationToken.Register(() => connectedTcs.TrySetResult(false)))
            {
                Task completed = await Task.WhenAny(connectedTcs.Task, Task.Delay(TimeSpan.FromSeconds(20), cancellationToken)).ConfigureAwait(false);
                if (completed != connectedTcs.Task || !connectedTcs.Task.Result)
                {
                    Console.Error.WriteLine("A conexao WebRTC nao foi estabelecida dentro do prazo.");
                    return 4;
                }
            }

            Console.WriteLine("Conectado. Iniciando transmissao de tela.");
            await StreamUntilEndedAsync(cancellationToken).ConfigureAwait(false);
            return 0;
        }

        private List<RTCIceServer> BuildIceServers()
        {
            var servers = new List<RTCIceServer>();
            if (parameters.IceServers == null) return servers;
            foreach (IceServerParameters server in parameters.IceServers)
            {
                if (string.IsNullOrWhiteSpace(server?.Urls)) continue;
                servers.Add(new RTCIceServer
                {
                    urls = server.Urls,
                    username = server.Username,
                    credential = server.Credential
                });
            }
            return servers;
        }

        private async Task WaitForIceGatheringCompleteAsync(TimeSpan timeout, CancellationToken cancellationToken)
        {
            DateTime deadline = DateTime.UtcNow.Add(timeout);
            while (peerConnection.iceGatheringState != RTCIceGatheringState.complete && DateTime.UtcNow < deadline)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await Task.Delay(100, cancellationToken).ConfigureAwait(false);
            }
        }

        /// <summary>
        /// Captura e envia quadros ate a sessao terminar no servidor, a
        /// conexao cair ou o cancelamento ser solicitado. Uma falha de
        /// captura isolada (tela bloqueada, monitor removido) nunca derruba o
        /// loop -- so pula aquele quadro, igual ao coletor principal.
        /// </summary>
        private async Task StreamUntilEndedAsync(CancellationToken cancellationToken)
        {
            Screen screen = ScreenCapture.FindScreen(parameters.MonitorId);
            const int maxWidth = 1280;
            int checkEndedEveryMs = 3000;
            DateTime nextEndCheck = DateTime.UtcNow;

            while (!cancellationToken.IsCancellationRequested && !stopping && connected)
            {
                DateTime frameStartedAt = DateTime.UtcNow;
                try
                {
                    (byte[] bgr, int width, int height) = ScreenCapture.CaptureBgr(screen, maxWidth);
                    if (bgr != null)
                    {
                        videoSource.ExternalVideoSourceRawSample(
                            (uint)parameters.CaptureIntervalMs, width, height, bgr, VideoPixelFormatsEnum.Bgr);
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Falha ao capturar/enviar quadro: " + ex.Message);
                }

                if (DateTime.UtcNow >= nextEndCheck)
                {
                    nextEndCheck = DateTime.UtcNow.AddMilliseconds(checkEndedEveryMs);
                    if (await signaling.HasSessionEndedAsync(cancellationToken).ConfigureAwait(false))
                    {
                        Console.WriteLine("Sessao encerrada no servidor.");
                        stopping = true;
                        break;
                    }
                }

                int elapsedMs = (int)(DateTime.UtcNow - frameStartedAt).TotalMilliseconds;
                int remainingMs = parameters.CaptureIntervalMs - elapsedMs;
                if (remainingMs > 0)
                {
                    try { await Task.Delay(remainingMs, cancellationToken).ConfigureAwait(false); }
                    catch (OperationCanceledException) { break; }
                }
            }
        }

        public void Dispose()
        {
            stopping = true;
            videoSource?.Dispose();
            peerConnection?.close();
            peerConnection?.Dispose();
            signaling?.Dispose();
        }
    }
}
