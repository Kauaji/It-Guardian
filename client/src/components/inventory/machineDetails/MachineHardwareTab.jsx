import {
  LicenseSection,
  MemorySection,
  MotherboardSection,
  PowerSection,
  ProcessorSection,
  StorageSection,
  SystemSection,
  VideoSection
} from "./HardwareSections.jsx";

export default function MachineHardwareTab({ model }) {
  const { machine, hardware, agent, isAgentAsset, isManualAsset } = model;
  return (
    <section className="asset-tab-content hardware-detail-layout">
      <SystemSection machine={machine} hardware={hardware} agent={agent} isAgentAsset={isAgentAsset} />
      <ProcessorSection hardware={hardware} />
      <MemorySection hardware={hardware} agent={agent} isAgentAsset={isAgentAsset} memoryModules={model.memoryModules} />
      <VideoSection graphicsAdapters={model.graphicsAdapters} />
      <MotherboardSection hardware={hardware} />
      <StorageSection
        agent={agent}
        isAgentAsset={isAgentAsset}
        isManualAsset={isManualAsset}
        diskHealth={model.diskHealth}
        disks={model.disks}
      />
      <PowerSection hardware={hardware} />
      <LicenseSection hardware={hardware} />
    </section>
  );
}
