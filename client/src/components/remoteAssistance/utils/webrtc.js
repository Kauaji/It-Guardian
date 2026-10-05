/**
 * Sem sinalizacao trickle no servidor (a oferta/resposta viajam como um SDP
 * unico por poll), a negociacao so pode acontecer depois que a coleta de
 * candidatos ICE termina -- por isso espera iceGatheringState virar
 * "complete" em vez de mandar candidatos avulsos conforme chegam. O mesmo
 * padrao e usado do lado do agente.
 */
export function waitForIceGatheringComplete(peerConnection, timeoutMs = 8000) {
  if (peerConnection.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    function checkState() {
      if (peerConnection.iceGatheringState === "complete") {
        peerConnection.removeEventListener("icegatheringstatechange", checkState);
        window.clearTimeout(timer);
        resolve();
      }
    }
    const timer = window.setTimeout(() => {
      peerConnection.removeEventListener("icegatheringstatechange", checkState);
      resolve();
    }, timeoutMs);
    peerConnection.addEventListener("icegatheringstatechange", checkState);
  });
}
