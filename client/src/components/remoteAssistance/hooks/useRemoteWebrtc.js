import { useEffect, useRef, useState } from "react";
import { fetchRemoteAssistanceWebrtcAnswer, sendRemoteAssistanceWebrtcOffer } from "../../../api.js";
import { waitForIceGatheringComplete } from "../utils/webrtc.js";

const ANSWER_POLL_MS = 1000;

// Visualizador WebRTC (recvonly): a oferta e a resposta SDP trafegam pelo
// backend como um SDP unico, consultado por polling ate a resposta chegar.
export function useRemoteWebrtc({ open, token, session, viewerToken, iceServers, onError }) {
  const videoRef = useRef(null);
  const [trackActive, setTrackActive] = useState(false);

  useEffect(() => {
    if (
      !open ||
      session?.status !== "active" ||
      session?.transport !== "webrtc" ||
      session?.paused ||
      !viewerToken
    ) {
      return undefined;
    }
    let cancelled = false;
    let answerPollTimer = null;
    const peerConnection = new RTCPeerConnection({ iceServers: iceServers || [] });
    setTrackActive(false);

    peerConnection.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
      setTrackActive(true);
    };
    peerConnection.addTransceiver("video", { direction: "recvonly" });

    async function pollAnswer() {
      if (cancelled || peerConnection.signalingState !== "have-local-offer") return;
      try {
        const result = await fetchRemoteAssistanceWebrtcAnswer({ token, sessionId: session.id, viewerToken });
        if (result.answer && !cancelled && peerConnection.signalingState === "have-local-offer") {
          window.clearInterval(answerPollTimer);
          await peerConnection.setRemoteDescription({ type: "answer", sdp: result.answer });
        }
      } catch (answerError) {
        if (!cancelled) onError(answerError.message);
      }
    }

    async function negotiate() {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await waitForIceGatheringComplete(peerConnection);
        if (cancelled) return;
        await sendRemoteAssistanceWebrtcOffer({
          token,
          sessionId: session.id,
          viewerToken,
          sdp: peerConnection.localDescription.sdp
        });
        answerPollTimer = window.setInterval(pollAnswer, ANSWER_POLL_MS);
      } catch (negotiationError) {
        if (!cancelled) onError(negotiationError.message);
      }
    }
    negotiate();

    return () => {
      cancelled = true;
      if (answerPollTimer) window.clearInterval(answerPollTimer);
      peerConnection.ontrack = null;
      peerConnection.close();
      if (videoRef.current) videoRef.current.srcObject = null;
      setTrackActive(false);
    };
  }, [iceServers, onError, open, session?.id, session?.paused, session?.status, session?.transport, token, viewerToken]);

  return { videoRef, trackActive };
}
