import { Boxes, Layers3 } from "lucide-react";
import ComputerKitsView from "./ComputerKitsView.jsx";
import PartsFamilyList from "./PartsFamilyList.jsx";

function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="parts-empty">
      <Icon size={34} />
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}

// Corpo da pagina: carregando, kits por computador ou familias de pecas (cada um com seu estado vazio).
export default function PartsContent({ loading, viewMode, parts, partFamilies, computerKits, kitProps, onOpenPart }) {
  if (loading) return <p className="dashboard-empty-state">Atualizando o inventário...</p>;
  if (viewMode === "kits") {
    return computerKits.length ? (
      <ComputerKitsView kits={computerKits} {...kitProps} />
    ) : (
      <EmptyState icon={Layers3} title="Nenhum kit encontrado">
        Os kits aparecem quando componentes físicos são identificados em uma máquina.
      </EmptyState>
    );
  }
  if (parts.length) return <PartsFamilyList families={partFamilies} onOpenPart={onOpenPart} />;
  return (
    <EmptyState icon={Boxes} title="Nenhuma peça encontrada">
      Cadastre um item ou importe uma NF-e. Os ativos monitorados são conciliados automaticamente.
    </EmptyState>
  );
}
