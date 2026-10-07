// Fatias do relatório do dashboard com os padrões de lista vazia, sem React.

/** Separa o relatório nas listas/objetos usados pelas seções, com [] quando faltam. */
export function buildReportSlices(report) {
  const overview = report?.overview || null;
  const assets = report?.assets || null;
  const alertsData = report?.alerts || null;
  const serviceOrdersData = report?.serviceOrders || null;
  const business = report?.business || null;

  return {
    overview,
    business,
    byStatus: assets?.byStatus || [],
    bySeverity: alertsData?.bySeverity || [],
    soByStatus: serviceOrdersData?.byStatus || [],
    soByPriority: serviceOrdersData?.byPriority || [],
    soTrend: serviceOrdersData?.trend || [],
    alertsTrend: alertsData?.trend || [],
    mostProblematic: assets?.mostProblematic || [],
    notSeenRecently: assets?.notSeenRecently || [],
    topRecurringAssets: alertsData?.topRecurringAssets || [],
    oldestOpen: serviceOrdersData?.oldestOpen || [],
    byTechnician: serviceOrdersData?.byTechnician || [],
    byEnvironment: business?.byEnvironment || []
  };
}

/** Itens da faixa de KPIs a partir do resumo geral (overview). */
export function buildKpiItems(overview) {
  return [
    {
      title: "OS abertas",
      value: overview ? overview.openServiceOrders : "--",
      subtitle: "Ordens de serviço ainda não finalizadas"
    },
    {
      title: "OS vencidas",
      value: overview?.overdueServiceOrdersAvailable ? overview.overdueServiceOrders : "Indisponível",
      subtitle: "Depende de prazo/SLA persistido (ainda não implementado)",
      tone: overview?.overdueServiceOrdersAvailable ? "" : "muted"
    },
    {
      title: "Em manutenção",
      value: overview ? overview.inMaintenanceAssets : "--",
      subtitle: "Ativos com manutenção ativa no momento"
    },
    {
      title: "Alertas resolvidos hoje",
      value: overview ? overview.resolvedAlertsToday : "--",
      subtitle: "Contagem do dia corrente",
      tone: "ok"
    }
  ];
}
