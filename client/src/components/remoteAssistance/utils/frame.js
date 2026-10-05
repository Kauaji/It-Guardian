// O agente pode enviar o quadro como data URL completa ou so o base64 do JPEG.
export function toFrameSrc(frame) {
  return frame.startsWith("data:image/") ? frame : `data:image/jpeg;base64,${frame}`;
}
