import { formatDate } from "./machineDetailsModel.js";

export default function MachineSoftwareTab({ softwareRows, isManualAsset }) {
  return (
    <section className="asset-tab-content">
      <div className="software-table-list">
        {softwareRows.map((software, index) => (
          <article key={`${software.name}-${software.version || "sem-versao"}-${index}`}>
            <strong>{software.name}</strong>
            <span>Versão: {software.version || "Não disponível"}</span>
            <span>Fabricante: {software.manufacturer || "Não disponível"}</span>
            <span>Instalação: {software.installedAt ? formatDate(software.installedAt) : "Não disponível"}</span>
          </article>
        ))}
      </div>
      {!softwareRows.length && !isManualAsset && <p className="empty">Nenhum software coletado para esta máquina.</p>}
      {isManualAsset && <p className="empty">Softwares não se aplicam a este ativo manual.</p>}
    </section>
  );
}
