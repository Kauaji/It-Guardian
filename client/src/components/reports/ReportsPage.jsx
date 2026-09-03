import { useMemo, useState } from "react";
import { Download, Printer, RefreshCw } from "lucide-react";
import { fetchReportCsv } from "../../api.js";
import { useReportData } from "../../hooks/useReportData.js";
import { hasPermission } from "../../permissions.js";
import { triggerCsvDownload } from "../../utils/csvDownload.js";
import ReportFilters from "./ReportFilters.jsx";
import ReportPreview from "./ReportPreview.jsx";
import { openReportPrintWindow } from "./reportPrintHtml.js";
import { buildReportFilterParams, canViewReportType, REPORT_TYPES } from "./reportUtils.js";

export default function ReportsPage({ token, user, notify }) {
  const visibleTypes = useMemo(
    () => REPORT_TYPES.filter((type) => canViewReportType(user, hasPermission, type.id)),
    [user]
  );
  const [selectedTypeId, setSelectedTypeId] = useState(visibleTypes[0]?.id || null);
  const [filtersByType, setFiltersByType] = useState({});
  const [exporting, setExporting] = useState(false);

  const selectedType = visibleTypes.find((type) => type.id === selectedTypeId) || null;
  const filters = filtersByType[selectedTypeId] || {};
  const appliedFilters = buildReportFilterParams(filters);

  const { data, loading, error, reload } = useReportData({
    token,
    type: selectedTypeId,
    filters: appliedFilters,
    canView: Boolean(selectedType),
    notify
  });

  const canExport = hasPermission(user, "reports.export");

  function handleFilterChange(nextFilters) {
    setFiltersByType((current) => ({ ...current, [selectedTypeId]: nextFilters }));
  }

  async function handleExportCsv() {
    if (!selectedType) return;
    setExporting(true);
    try {
      const csv = await fetchReportCsv(token, selectedType.id, appliedFilters);
      triggerCsvDownload(`relatorio-${selectedType.id}.csv`, csv);
    } catch (exportError) {
      notify?.(exportError.message, "danger");
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    if (!selectedType || !data) return;
    openReportPrintWindow({
      typeId: selectedType.id,
      typeLabel: selectedType.label,
      generatedAt: new Date().toLocaleString("pt-BR"),
      data,
      notify
    });
  }

  if (!visibleTypes.length) {
    return <p className="empty-state">Voce nao tem permissao para visualizar relatorios.</p>;
  }

  return (
    <section className="reports-page">
      <div className="report-type-cards">
        {visibleTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            className={`report-type-card ${type.id === selectedTypeId ? "active" : ""}`}
            onClick={() => setSelectedTypeId(type.id)}
          >
            <strong>{type.label}</strong>
            <span>{type.description}</span>
          </button>
        ))}
      </div>

      {selectedType && (
        <>
          <ReportFilters type={selectedType} filters={filters} onChange={handleFilterChange} />

          <div className="toolbar report-actions">
            <button type="button" className="secondary-action" onClick={reload} disabled={loading}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              Atualizar
            </button>
            {canExport && (
              <button
                type="button"
                className="secondary-action"
                onClick={handleExportCsv}
                disabled={exporting || !data}
              >
                <Download size={16} />
                Exportar CSV
              </button>
            )}
            <button type="button" className="secondary-action" onClick={handlePrint} disabled={!data}>
              <Printer size={16} />
              Imprimir
            </button>
          </div>

          <ReportPreview type={selectedType} data={data} loading={loading} error={error} />
        </>
      )}
    </section>
  );
}
