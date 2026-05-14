import { Clock3, HardDrive, MemoryStick, Monitor, Network, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchPublicDevice } from "../../api.js";
import AssetTypeIcon from "./AssetTypeIcon.jsx";
import { assetTypeLabel } from "./assetTypes.js";
import PeripheralItem from "./PeripheralItem.jsx";

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "Nao informado"}</strong>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function AssetPublicView({ assetId }) {
  const [machine, setMachine] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPublicDevice(assetId)
      .then((response) => setMachine(response.device))
      .catch((requestError) => setError(requestError.message));
  }, [assetId]);

  if (error) {
    return (
      <main className="asset-public-page">
        <section className="asset-public-card">
          <h1>Ativo nao encontrado</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!machine) {
    return (
      <main className="asset-public-page">
        <section className="asset-public-card">
          <h1>Carregando ficha tecnica...</h1>
        </section>
      </main>
    );
  }

  const hardware = machine.hardware || {};
  const isManualAsset = machine.source === "manual";

  return (
    <main className="asset-public-page">
      <section className="asset-public-card">
        <header>
          <QrCode size={24} />
          <div>
            <span>Ficha tecnica IT Guardian</span>
            <h1>{machine.name}</h1>
            <p>{machine.ip} - {machine.statusLabel} - {assetTypeLabel(machine.assetType)}</p>
          </div>
        </header>

        <div className="asset-public-metrics">
          {isManualAsset ? (
            <>
              <article><AssetTypeIcon type={machine.assetType} size={16} />Tipo <strong>{assetTypeLabel(machine.assetType)}</strong></article>
              <article><Clock3 size={16} />Ultimo ping <strong>{formatDate(machine.lastPingAt)}</strong></article>
              <article><Network size={16} />Status <strong>{machine.statusLabel}</strong></article>
              <article><HardDrive size={16} />Patrimonio <strong>{hardware.assetTag}</strong></article>
            </>
          ) : (
            <>
              <article><Monitor size={16} />CPU <strong>{machine.metrics.cpu}%</strong></article>
              <article><MemoryStick size={16} />RAM <strong>{machine.metrics.ram}%</strong></article>
              <article><HardDrive size={16} />Disco <strong>{machine.metrics.disk}%</strong></article>
              <article><Network size={16} />Rede <strong>{machine.metrics.networkInMbps} Mbps</strong></article>
            </>
          )}
        </div>

        <div className="detail-grid">
          <DetailItem label={isManualAsset ? "Tipo" : "Sistema operacional"} value={isManualAsset ? assetTypeLabel(machine.assetType) : hardware.os} />
          <DetailItem label="Fabricante" value={hardware.manufacturer} />
          <DetailItem label="Modelo" value={hardware.model} />
          <DetailItem label="Serial" value={hardware.serialNumber} />
          <DetailItem label="Patrimonio" value={hardware.assetTag} />
          <DetailItem label="MAC Address" value={hardware.macAddress} />
          <DetailItem label="Hostname" value={machine.manualAsset?.hostname} />
          <DetailItem label="Localizacao" value={machine.manualAsset?.location} />
        </div>

        {!isManualAsset && (
          <section className="asset-public-section">
            <h2>Perifericos</h2>
            <ul className="peripheral-list">
              {(hardware.peripherals || []).map((peripheral) => (
                <PeripheralItem key={peripheral.id} peripheral={peripheral} />
              ))}
            </ul>
          </section>
        )}

        <button className="ghost-action print-action" onClick={() => window.print()}>Imprimir ficha</button>
      </section>
    </main>
  );
}
