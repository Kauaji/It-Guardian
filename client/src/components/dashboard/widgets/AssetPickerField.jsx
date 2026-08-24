import { useEffect, useState } from "react";
import { fetchDevices } from "../../../api.js";

/**
 * Widgets de metrica por ativo (grafico/gauge) precisam de um assetId
 * escolhido pelo usuario -- reaproveita a mesma listagem de dispositivos ja
 * usada pelo Inventario, sem inventar um endpoint novo so para o seletor.
 */
export default function AssetPickerField({ token, value, onChange }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDevices(token)
      .then((result) => {
        if (!cancelled) setDevices(Array.isArray(result.devices) ? result.devices : []);
      })
      .catch(() => {
        if (!cancelled) setDevices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <label>
      Ativo
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} disabled={loading}>
        <option value="">{loading ? "Carregando..." : "Selecione um ativo"}</option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.name}
          </option>
        ))}
      </select>
    </label>
  );
}
