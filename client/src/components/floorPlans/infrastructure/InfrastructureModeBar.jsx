import { Flame, LayoutDashboard, Layers3, Loader2, Monitor, Trash2, Upload } from "lucide-react";
import { buildBackgroundScaleSettings, filterCompatibleSegments } from "../utils/infrastructure.js";

function ModeSwitch({ mode, canViewHeatmaps, onModeChange }) {
  return (
    <div className="infrastructure-mode-switch" aria-label="Modo do mapa de infraestrutura">
      <button type="button" className={mode === "normal" ? "active" : ""} onClick={() => onModeChange("normal")}><Monitor size={15} /> Planta</button>
      <button type="button" disabled={!canViewHeatmaps} className={mode === "heatmap-os" ? "active" : ""} onClick={() => onModeChange("heatmap-os")}><Flame size={15} /> Calor de OS</button>
      <button type="button" disabled={!canViewHeatmaps} className={mode === "heatmap-assets" ? "active" : ""} onClick={() => onModeChange("heatmap-assets")}><Layers3 size={15} /> Calor de ativos</button>
      <button type="button" disabled={!canViewHeatmaps} className={mode === "dashboard" ? "active" : ""} onClick={() => onModeChange("dashboard")}><LayoutDashboard size={15} /> Resumo</button>
    </div>
  );
}

function GroupSegmentFilters({ groupId, segmentId, groups, segments, onGroupChange, onSegmentChange }) {
  const compatibleSegments = filterCompatibleSegments(segments, groupId);
  return (
    <>
      <select aria-label="Filtrar por grupo" value={groupId} onChange={(event) => onGroupChange(event.target.value)}>
        <option value="">Todos os grupos</option>
        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
      <select aria-label="Filtrar por segmento" value={segmentId} onChange={(event) => onSegmentChange(event.target.value)}>
        <option value="">Todos os segmentos</option>
        {compatibleSegments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
      </select>
    </>
  );
}

function PeriodSelect({ period, onPeriodChange }) {
  return (
    <select aria-label="Período do mapa de OS" value={period} onChange={(event) => onPeriodChange(event.target.value)}>
      <option value="7">Últimos 7 dias</option>
      <option value="30">Últimos 30 dias</option>
      <option value="current_month">Mês atual</option>
      <option value="previous_month">Mês anterior</option>
    </select>
  );
}

function MetricSelect({ metric, onMetricChange }) {
  return <select aria-label="Métrica do mapa de ativos" value={metric} onChange={(event) => onMetricChange(event.target.value)}><option value="availability">Disponibilidade</option><option value="cpu">CPU</option><option value="ram">RAM</option><option value="disk">Disco</option><option value="alerts">Alertas</option><option value="service_orders">Chamados</option></select>;
}

function BackgroundControls({ floor, backgroundSettings, onBackgroundSettings }) {
  const backgroundScale = Number(backgroundSettings.scale || 1);
  const updateSetting = (patch) => onBackgroundSettings({ ...backgroundSettings, ...patch });
  return (
    <details className="floor-plan-background-controls">
      <summary>Ajustar fundo</summary>
      <div>
        <label>Opacidade <input type="range" min="0.15" max="1" step="0.05" value={backgroundSettings.opacity ?? 0.72} onChange={(event) => updateSetting({ opacity: Number(event.target.value) })} /></label>
        <label>Escala <input type="range" min="0.5" max="1.5" step="0.05" value={backgroundScale} onChange={(event) => onBackgroundSettings(buildBackgroundScaleSettings(backgroundSettings, floor, Number(event.target.value)))} /></label>
        <label>X <input type="number" step="5" value={Number(backgroundSettings.x || 0)} onChange={(event) => updateSetting({ x: Number(event.target.value) })} /></label>
        <label>Y <input type="number" step="5" value={Number(backgroundSettings.y || 0)} onChange={(event) => updateSetting({ y: Number(event.target.value) })} /></label>
        <label>Encaixe <select value={backgroundSettings.fit || "contain"} onChange={(event) => updateSetting({ fit: event.target.value })}><option value="contain">Conter</option><option value="stretch">Preencher</option></select></label>
      </div>
    </details>
  );
}

function UploadActions({ hasBackground, backgroundBusy, onUpload, onRemoveBackground }) {
  return (
    <>
      <button type="button" className="secondary-action" disabled={backgroundBusy} onClick={onUpload}>{backgroundBusy ? <Loader2 className="spin" size={15} /> : <Upload size={15} />} {hasBackground ? "Trocar planta" : "Enviar planta"}</button>
      {hasBackground ? <button type="button" className="icon-button danger" disabled={backgroundBusy} title="Remover imagem de fundo" onClick={onRemoveBackground}><Trash2 size={16} /></button> : null}
    </>
  );
}

export default function InfrastructureModeBar({
  mode,
  onModeChange,
  metric,
  onMetricChange,
  period,
  onPeriodChange,
  groupId,
  onGroupChange,
  segmentId,
  onSegmentChange,
  groups,
  segments,
  floor,
  hasBackground,
  backgroundBusy,
  canUpload,
  canViewHeatmaps,
  onUpload,
  onRemoveBackground,
  backgroundSettings,
  onBackgroundSettings
}) {
  return (
    <div className="infrastructure-mode-bar">
      <ModeSwitch mode={mode} canViewHeatmaps={canViewHeatmaps} onModeChange={onModeChange} />
      <div className="infrastructure-context-actions">
        {mode !== "normal" ? (
          <GroupSegmentFilters groupId={groupId} segmentId={segmentId} groups={groups} segments={segments} onGroupChange={onGroupChange} onSegmentChange={onSegmentChange} />
        ) : null}
        {mode === "heatmap-os" ? <PeriodSelect period={period} onPeriodChange={onPeriodChange} /> : null}
        {mode === "heatmap-assets" ? <MetricSelect metric={metric} onMetricChange={onMetricChange} /> : null}
        {hasBackground ? <BackgroundControls floor={floor} backgroundSettings={backgroundSettings} onBackgroundSettings={onBackgroundSettings} /> : null}
        {canUpload ? <UploadActions hasBackground={hasBackground} backgroundBusy={backgroundBusy} onUpload={onUpload} onRemoveBackground={onRemoveBackground} /> : null}
      </div>
    </div>
  );
}
