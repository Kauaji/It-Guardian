/**
 * Comparacao de versoes numericas separadas por ponto (ex.: 1.10.0). Segmentos
 * nao numericos contam como zero.
 */

export function compareVersions(a, b) {
  const partsA = String(a || "0").split(".").map((part) => parseInt(part, 10) || 0);
  const partsB = String(b || "0").split(".").map((part) => parseInt(part, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (partsA[index] || 0) - (partsB[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** A versao disponivel e mais nova que a reportada pelo agente? (false se alguma esta ausente) */
export function isUpdateAvailable(availableVersion, reportedVersion) {
  return Boolean(availableVersion) && Boolean(reportedVersion) && compareVersions(availableVersion, reportedVersion) > 0;
}
