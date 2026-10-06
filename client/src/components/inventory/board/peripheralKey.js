// Identificador de um periferico: id ou tipo-marca-patrimonio.
export function peripheralKey(item) {
  return item.id || `${item.type}-${item.brand}-${item.assetTag}`;
}
