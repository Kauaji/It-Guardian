import { ASSET_TYPE_TO_PRESET } from "./visualMapPresets.js";

export function getDeviceName(device) {
  return device?.name || device?.hostname || device?.label || device?.id || "Ativo";
}

export function getDevicePreset(device) {
  const rawType = String(device?.assetType || device?.type || device?.deviceType || "").toLowerCase();
  return ASSET_TYPE_TO_PRESET[rawType] || "desktop";
}

export function getDeviceMeta(device, fallback = "Não informado") {
  return {
    status: device?.status || fallback,
    ip: device?.ip || device?.address || fallback,
    os: device?.os || device?.operatingSystem || fallback,
    segment: device?.segmentName || device?.segment || fallback,
    group: device?.groupName || device?.group || fallback,
    environment: device?.tabName || device?.environmentName || fallback
  };
}
