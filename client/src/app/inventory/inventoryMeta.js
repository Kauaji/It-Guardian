// Transformacoes puras do metadado local de abas (grupos/segmentos/ativos ->
// aba + ordem). Os hooks aplicam estas funcoes via saveInventoryTabMeta.

export function mergeInventoryMeta(current, kind, id, updates) {
  return {
    ...current,
    [kind]: {
      ...(current[kind] || {}),
      [id]: {
        ...(current[kind]?.[id] || {}),
        ...updates
      }
    }
  };
}

// Atribui ativos a uma aba. Ao mover para o segmento padrao ("Nao
// organizadas") a aba some do metadado: o ativo volta a ser global.
export function assignDevicesToTab(current, deviceIds, targetSegment, targetTabId) {
  const ids = Array.isArray(deviceIds) ? deviceIds : [deviceIds];
  const targetIsDefault = Boolean(targetSegment?.isDefault);
  const nextDevices = { ...(current.devices || {}) };

  for (const id of ids.filter(Boolean)) {
    const currentMeta = { ...(nextDevices[id] || {}) };

    if (targetIsDefault) {
      delete currentMeta.tabId;
      if (Object.keys(currentMeta).length) {
        nextDevices[id] = currentMeta;
      } else {
        delete nextDevices[id];
      }
    } else {
      nextDevices[id] = { ...currentMeta, tabId: targetTabId };
    }
  }

  return { ...current, devices: nextDevices };
}

// Regrava a ordem de uma colecao ("groups" ou "segments") conforme a nova
// sequencia de ids, mantendo todos na aba informada.
export function applyOrderedIds(current, kind, orderedIds, tabId) {
  return {
    ...current,
    [kind]: {
      ...(current[kind] || {}),
      ...Object.fromEntries(
        orderedIds.map((id, index) => [
          id,
          {
            ...(current[kind]?.[id] || {}),
            tabId,
            order: index
          }
        ])
      )
    }
  };
}

// Ao excluir uma aba, tudo que pertencia a ela passa para a aba de destino.
export function reassignTabMeta(current, fromTabId, toTabId) {
  const reassign = (collection) =>
    Object.fromEntries(
      Object.entries(collection || {}).map(([id, meta]) => [
        id,
        meta.tabId === fromTabId ? { ...meta, tabId: toTabId } : meta
      ])
    );

  return {
    groups: reassign(current.groups),
    segments: reassign(current.segments),
    devices: reassign(current.devices)
  };
}
