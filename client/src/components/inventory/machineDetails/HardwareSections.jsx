import { Battery, CircuitBoard, Cpu, HardDrive, KeyRound, Laptop, MemoryStick, Monitor } from "lucide-react";
import { formatHardwareValue } from "../hardwarePresentation.js";
import DetailItem from "./DetailItem.jsx";
import HardwareSection from "./HardwareSection.jsx";
import { formatBytes, formatDuration } from "./machineDetailsModel.js";

export function SystemSection({ machine, hardware, agent, isAgentAsset }) {
  return (
    <HardwareSection icon={Laptop} title="Sistema e equipamento">
      <div className="detail-grid hardware-detail-grid">
        <DetailItem label="Hostname" value={machine.name} />
        <DetailItem label="Sistema operacional" value={hardware.os} />
        <DetailItem label="Versão do SO" value={hardware.osVersion || hardware.os} />
        <DetailItem label="Arquitetura" value={hardware.architecture} />
        <DetailItem label="Fabricante" value={hardware.manufacturer} />
        <DetailItem label="Modelo" value={hardware.model} />
        <DetailItem label="Serial number" value={hardware.serialNumber} />
        {isAgentAsset && (
          <>
            <DetailItem label="Uptime" value={formatDuration(agent?.uptimeSeconds)} />
            <DetailItem label="Usuário local" value={agent?.loggedUser || "Coleta desativada"} />
          </>
        )}
      </div>
    </HardwareSection>
  );
}

export function ProcessorSection({ hardware }) {
  return (
    <HardwareSection icon={Cpu} title="Processador">
      <div className="detail-grid hardware-detail-grid">
        <DetailItem label="Modelo" value={hardware.cpuModel || hardware.cpuDetails?.name} />
        <DetailItem label="Núcleos físicos" value={hardware.cpuCores || hardware.cpuDetails?.cores} />
        <DetailItem label="Processadores lógicos" value={hardware.cpuDetails?.logicalProcessors} />
        <DetailItem label="Sockets" value={hardware.cpuDetails?.sockets} />
        <DetailItem label="Socket" value={hardware.cpuDetails?.socket} />
        <DetailItem
          label="Clock máximo"
          value={hardware.cpuDetails?.maxClockMhz ? `${hardware.cpuDetails.maxClockMhz} MHz` : null}
        />
        <DetailItem
          label="Virtualização"
          value={hardware.cpuDetails?.virtualizationEnabled == null
            ? null
            : hardware.cpuDetails.virtualizationEnabled}
        />
      </div>
    </HardwareSection>
  );
}

export function MemorySection({ hardware, agent, isAgentAsset, memoryModules }) {
  return (
    <HardwareSection icon={MemoryStick} title="Memória">
      <div className="detail-grid hardware-detail-grid">
        <DetailItem label="Total instalado" value={hardware.ramGb ? `${hardware.ramGb} GB` : null} />
        {isAgentAsset && <DetailItem label="Total detectado" value={formatBytes(agent?.memoryTotalBytes)} />}
        <DetailItem label="Saúde geral" value={hardware.memoryHealth?.status || hardware.memoryHealth} />
        <DetailItem
          label="Módulos detectados"
          value={memoryModules.length || hardware.memoryHealth?.modules}
        />
      </div>
      <div className="hardware-component-list">
        {memoryModules.map((module, index) => (
          <article key={`${module.bank || "memory"}-${module.serialNumber || index}`}>
            <header>
              <MemoryStick size={16} aria-hidden="true" />
              <strong>{module.bank || `Módulo ${index + 1}`}</strong>
              <span>{formatHardwareValue(module.status, "Status não informado")}</span>
            </header>
            <dl>
              <div><dt>Capacidade</dt><dd>{formatHardwareValue(module.capacityGb ? `${module.capacityGb} GB` : null)}</dd></div>
              <div><dt>Velocidade</dt><dd>{formatHardwareValue(module.speedMhz ? `${module.speedMhz} MHz` : null)}</dd></div>
              <div><dt>Fabricante</dt><dd>{formatHardwareValue(module.manufacturer)}</dd></div>
              <div><dt>Part number</dt><dd>{formatHardwareValue(module.partNumber)}</dd></div>
              <div><dt>Serial</dt><dd>{formatHardwareValue(module.serialNumber)}</dd></div>
            </dl>
          </article>
        ))}
        {!memoryModules.length && <p className="empty">Nenhum módulo individual identificado.</p>}
      </div>
    </HardwareSection>
  );
}

export function VideoSection({ graphicsAdapters }) {
  return (
    <HardwareSection icon={Monitor} title="Vídeo">
      <div className="hardware-component-list">
        {graphicsAdapters.map((adapter, index) => (
          <article key={`${adapter.name || "graphics"}-${index}`}>
            <header>
              <Monitor size={16} aria-hidden="true" />
              <strong>{formatHardwareValue(adapter.name, `Adaptador ${index + 1}`)}</strong>
              <span>{formatHardwareValue(adapter.status, "Status não informado")}</span>
            </header>
            <dl>
              <div><dt>Processador gráfico</dt><dd>{formatHardwareValue(adapter.videoProcessor)}</dd></div>
              <div><dt>Memória</dt><dd>{formatHardwareValue(adapter.memoryBytes ? formatBytes(adapter.memoryBytes) : null)}</dd></div>
              <div><dt>Driver</dt><dd>{formatHardwareValue(adapter.driverVersion)}</dd></div>
              <div><dt>Resolução</dt><dd>{formatHardwareValue(adapter.resolution)}</dd></div>
            </dl>
          </article>
        ))}
        {!graphicsAdapters.length && <p className="empty">Nenhum adaptador de vídeo identificado.</p>}
      </div>
    </HardwareSection>
  );
}

export function MotherboardSection({ hardware }) {
  return (
    <HardwareSection icon={CircuitBoard} title="Placa-mãe">
      <div className="detail-grid hardware-detail-grid">
        <DetailItem label="Fabricante" value={hardware.motherboard?.manufacturer} />
        <DetailItem label="Produto" value={hardware.motherboard?.product} />
        <DetailItem label="Versão" value={hardware.motherboard?.version} />
        <DetailItem label="Serial" value={hardware.motherboard?.serialNumber} />
        <DetailItem label="Status" value={hardware.motherboard?.status} />
      </div>
    </HardwareSection>
  );
}

export function StorageSection({ agent, isAgentAsset, isManualAsset, diskHealth, disks }) {
  return (
    <HardwareSection icon={HardDrive} title="Armazenamento">
      <div className="detail-grid hardware-detail-grid">
        {isAgentAsset && (
          <>
            <DetailItem label="Total" value={formatBytes(agent?.diskTotalBytes)} />
            <DetailItem label="Livre" value={formatBytes(agent?.diskFreeBytes)} />
          </>
        )}
        <DetailItem label="Saúde geral" value={diskHealth} />
        <DetailItem label="Unidades detectadas" value={disks.length} />
      </div>
      <div className="disk-detail-list">
        {disks.map((disk, index) => (
          <article key={`${disk.label || "disk"}-${index}`}>
            <HardDrive size={16} aria-hidden="true" />
            <strong>{formatHardwareValue(disk.label, `Disco ${index + 1}`)}</strong>
            <span>{formatHardwareValue(disk.sizeGb ? `${disk.sizeGb} GB - ${disk.type || "tipo não informado"}` : disk.type)}</span>
            <small>SMART: {formatHardwareValue(disk.smartStatus || disk.health)}</small>
            <small>Saúde estimada: {formatHardwareValue(disk.healthEstimate || (disk.healthPercent != null ? `${disk.healthPercent}% (estimativa)` : null))}</small>
            <small>Temperatura: {formatHardwareValue(disk.temperatureC ? `${disk.temperatureC} C` : null)}</small>
            <small>Horas ligadas: {formatHardwareValue(disk.powerOnHours)}</small>
            <small>Setores realocados: {formatHardwareValue(disk.reallocatedSectors)}</small>
            <small>TB escritos: {formatHardwareValue(disk.tbWritten)}</small>
          </article>
        ))}
        {!disks.length && (
          <p className="empty">
            {isManualAsset
              ? "Ativo de rede sem coleta automática de discos."
              : "Nenhuma unidade física identificada."}
          </p>
        )}
      </div>
    </HardwareSection>
  );
}

export function PowerSection({ hardware }) {
  return (
    <HardwareSection icon={Battery} title="Energia">
      <div className="detail-grid hardware-detail-grid">
        <DetailItem label="Bateria" value={hardware.battery?.name} />
        <DetailItem
          label="Carga"
          value={hardware.battery?.chargePercent != null ? `${hardware.battery.chargePercent}%` : null}
        />
        <DetailItem label="Status" value={hardware.battery?.status} />
        <DetailItem
          label="Autonomia estimada"
          value={hardware.battery?.estimatedMinutes
            ? `${hardware.battery.estimatedMinutes} min`
            : null}
        />
      </div>
    </HardwareSection>
  );
}

export function LicenseSection({ hardware }) {
  return (
    <>
      <HardwareSection icon={KeyRound} title="Licenciamento">
        <div className="detail-grid hardware-detail-grid">
          <DetailItem label="Licença Windows" value={hardware.licenses?.windowsKey || hardware.windowsKey} />
          <DetailItem label="Office" value={hardware.licenses?.officeVersion || hardware.officeVersion} />
          <DetailItem label="Licença Office" value={hardware.licenses?.officeKey || hardware.officeKey} />
        </div>
      </HardwareSection>

      <div className="license-note">
        <KeyRound size={16} />
        <span>Licenças e saúde física dependem dos dados disponibilizados pelo Windows e pelas fontes integradas.</span>
      </div>
    </>
  );
}
