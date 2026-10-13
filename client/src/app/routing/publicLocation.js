// Detecta as paginas publicas (sem login) a partir da URL. A precedencia e a
// mesma do App original: acompanhamento por token > formulario publico de
// chamado > ficha publica de ativo (/assets/:id ou ?asset=).
const supportFormPaths = ["/abrir-chamado", "/solicitar-suporte"];
// Link enviado por e-mail: a pessoa nao tem sessao, entao a pagina e publica.
export const PASSWORD_RESET_PATH = "/redefinir-senha";

export function parsePublicLocation({ pathname = "/", search = "" } = {}) {
  const isSupportFormPath = supportFormPaths.includes(pathname);
  const isPasswordReset = pathname === PASSWORD_RESET_PATH;
  const trackingToken = pathname.match(/^\/chamado\/([^/]+)/)?.[1];
  const pathAssetId = pathname.match(/^\/assets\/([^/]+)/)?.[1];
  const assetId = pathAssetId ? decodeURIComponent(pathAssetId) : new URLSearchParams(search).get("asset");
  const isPublicSupportPath = isSupportFormPath || Boolean(trackingToken);

  let kind = null;
  if (isPasswordReset) kind = "passwordReset";
  else if (trackingToken) kind = "tracking";
  else if (isSupportFormPath) kind = "support";
  else if (assetId) kind = "asset";

  return {
    kind,
    assetId,
    isPasswordReset,
    isPublicSupportPath,
    trackingToken: trackingToken ? decodeURIComponent(trackingToken) : null
  };
}
