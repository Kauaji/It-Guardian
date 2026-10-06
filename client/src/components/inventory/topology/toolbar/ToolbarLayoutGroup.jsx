import { RotateCcw, Save, Sparkles } from "lucide-react";

export default function ToolbarLayoutGroup({
  canManage,
  isClusterLevel,
  hasDirtyPositions,
  saving,
  generatingLayout,
  layoutBusy,
  nodeCount,
  onSaveLayout,
  onResetLayout,
  onGenerateAutoLayout
}) {
  return (
    <div className="network-topology-toolbar-group">
      {canManage ? (
        <>
          <button
            type="button"
            className="network-topology-toolbar-button"
            onClick={onSaveLayout}
            disabled={!hasDirtyPositions || layoutBusy}
          >
            <Save size={15} />
            {saving ? "Salvando..." : "Salvar layout"}
          </button>
          <button
            type="button"
            className="network-topology-toolbar-button"
            onClick={onResetLayout}
            disabled={!hasDirtyPositions || layoutBusy}
          >
            <RotateCcw size={15} />
            Resetar
          </button>
          {!isClusterLevel ? (
            <button
              type="button"
              className="network-topology-toolbar-button"
              onClick={onGenerateAutoLayout}
              disabled={layoutBusy || nodeCount === 0}
            >
              <Sparkles size={15} />
              {generatingLayout ? "Gerando..." : "Gerar automático"}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
