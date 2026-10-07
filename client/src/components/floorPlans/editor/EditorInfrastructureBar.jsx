import InfrastructureModeBar from "../infrastructure/InfrastructureModeBar.jsx";

/** Barra do mapa de infraestrutura (modos, filtros, fundo) ligada ao workspace. */
export default function EditorInfrastructureBar({ workspace, groups, segments, permissions }) {
  const { session, doc, infra, background } = workspace;

  return (
    <>
      <InfrastructureModeBar
        mode={infra.mode}
        onModeChange={infra.changeMode}
        metric={infra.metric}
        onMetricChange={infra.setMetric}
        period={infra.period}
        onPeriodChange={infra.setPeriod}
        groupId={infra.groupId}
        onGroupChange={infra.changeGroup}
        segmentId={infra.segmentId}
        onSegmentChange={infra.setSegmentId}
        groups={groups}
        segments={segments}
        floor={doc.activeFloorRecord}
        hasBackground={Boolean(doc.activeFloorRecord?.backgroundUrl)}
        backgroundBusy={background.busy}
        canUpload={Boolean(permissions.uploadBackground && session.isEditing)}
        canViewHeatmaps={Boolean(permissions.viewHeatmaps)}
        onUpload={background.openFilePicker}
        onRemoveBackground={background.remove}
        backgroundSettings={background.settings}
        onBackgroundSettings={background.updateSettings}
      />
      <input
        ref={background.inputRef}
        className="floor-plan-background-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={background.upload}
        disabled={background.busy}
      />
    </>
  );
}
