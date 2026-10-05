/**
 * Gera o QR code do URI otpauth LOCALMENTE (lib `qrcode` do proprio client):
 * o segredo do MFA nunca sai do navegador para um servico externo. A lib e
 * carregada sob demanda para nao pesar no bundle inicial.
 */
export async function generateQrDataUrl(text) {
  const module = await import("qrcode");
  const QRCode = module.default || module;
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1, width: 208 });
}
