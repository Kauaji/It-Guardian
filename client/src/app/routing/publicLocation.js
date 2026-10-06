// Detecta as paginas publicas (sem login) a partir da URL. A precedencia e a
// mesma do App original: acompanhamento por token > formulario publico de
// chamado > ficha publica de ativo (/assets/:id ou ?asset=).
const supportFormPaths = ["/abrir-chamado", "/solicitar-suporte"];

export function parsePublicLocation({ pathname = "/", search = "" } = {}) {
  const isSupportFormPath = supportFormPaths.includes(pathname);
  const trackingToken = pathname.match(/^\/chamado\/([^/]+)/)?.[1];
  const pathAssetId = pathname.match(/^\/assets\/([^/]+)/)?.[1];
  const assetId = pathAssetId ? decodeURIComponent(pathAssetId) : new URLSearchParams(search).get("asset");
  const isPublicSupportPath = isSupportFormPath || Boolean(trackingToken);

  let kind = null;
  if (trackingToken) kind = "tracking";
  else if (isSupportFormPath) kind = "support";
  else if (assetId) kind = "asset";

  return {
    kind,
    assetId,
    isPublicSupportPath,
    trackingToken: trackingToken ? decodeURIComponent(trackingToken) : null
  };
}
