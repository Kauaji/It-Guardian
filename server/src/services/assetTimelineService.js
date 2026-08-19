import { listServiceOrdersByAssetId } from "../repositories/serviceOrderRepository.js";
import { listAssetHistory } from "../repositories/assetHistoryRepository.js";
import { listRemoteAssistanceEventsByAssetId } from "../repositories/remoteAssistanceRepository.js";
import { findNetworkTopologyReferencesForAsset } from "../repositories/networkTopologyRepository.js";
import { findManualAssetById } from "../repositories/manualAssetRepository.js";
import { findAgentAssetById } from "../repositories/agentRepository.js";
import { getHostAlertsWithAcknowledgements } from "./alertService.js";
import { hasPermission } from "../permissions.js";

export const TIMELINE_CATEGORIES = [
  "asset",
  "status",
  "segment",
  "maintenance",
  "service_order",
  "alert",
  "preventive",
  "remote_assistance",
  "observation",
  "hardware",
  "part",
  "topology",
  "system"
];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const PERIOD_TO_MS = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000
};

// Fontes ja cobertas com mais detalhe por builders dedicados (OS e assistencia
// remota) - excluidas do backbone generico pra nao duplicar o mesmo evento.
const BACKBONE_EXCLUDED_PREFIXES = ["service_order_", "remote_assistance_"];

const BACKBONE_CATEGORY_RULES = [
  { prefix: "network_topology_", category: "topology" },
  { prefix: "preventive_", category: "preventive" },
  { prefix: "alert_suggestion_", category: "alert" },
  { prefix: "maintenance", category: "maintenance" },
  { prefix: "backup", category: "maintenance" },
  { prefix: "segment", category: "segment" },
  { prefix: "moved_to_segment", category: "segment" },
  { prefix: "peripheral", category: "hardware" }
];

export function resolveBackboneCategory(eventType) {
  const rule = BACKBONE_CATEGORY_RULES.find(({ prefix }) => eventType.startsWith(prefix));
  return rule ? rule.category : "system";
}

// O backend so grava um unico event_type "maintenance" tanto pra entrada
// quanto pra saida de manutencao (a mensagem e que diferencia) - tratado
// como warning nas duas direcoes, ja que ambas merecem atencao na timeline.
export function resolveBackboneSeverity(eventType, category) {
  if (category === "maintenance") return "warning";
  if (category === "preventive" || category === "topology") return "info";
  return "neutral";
}

function makeEvent({
  id,
  assetId,
  occurredAt,
  category,
  type,
  title,
  description,
  severity = "info",
  sourceModule,
  actorName = null,
  relatedEntityType = null,
  relatedEntityId = null,
  metadata = {}
}) {
  return {
    id,
    assetId,
    occurredAt,
    category,
    type,
    title,
    description,
    severity,
    sourceModule,
    actorName,
    relatedEntityType,
    relatedEntityId,
    metadata
  };
}

export function buildServiceOrderEvents(assetId, orders) {
  const events = [];
  for (const order of orders) {
    events.push(
      makeEvent({
        id: `service-order-${order.id}-created`,
        assetId,
        occurredAt: order.createdAt,
        category: "service_order",
        type: "service_order_created",
        title: `OS #${order.number} aberta`,
        description: order.title || order.description || "",
        severity: order.priority === "critical" ? "critical" : order.priority === "high" ? "warning" : "info",
        sourceModule: "service_orders",
        actorName: order.requesterName || null,
        relatedEntityType: "service_order",
        relatedEntityId: order.id,
        metadata: {
          number: order.number,
          priority: order.priority,
          status: order.status,
          requesterName: order.requesterName,
          assignedTechnicianName: order.assignedTechnicianName
        }
      })
    );

    if (order.closedAt) {
      events.push(
        makeEvent({
          id: `service-order-${order.id}-closed`,
          assetId,
          occurredAt: order.closedAt,
          category: "service_order",
          type: "service_order_closed",
          title: `OS #${order.number} finalizada`,
          description: order.solution || order.servicePerformed || "",
          severity: "success",
          sourceModule: "service_orders",
          actorName: order.assignedTechnicianName || null,
          relatedEntityType: "service_order",
          relatedEntityId: order.id,
          metadata: { number: order.number, status: order.status }
        })
      );
    }

    for (const item of order.items || []) {
      events.push(
        makeEvent({
          id: `service-order-item-${item.id}`,
          assetId,
          occurredAt: item.createdAt,
          category: "part",
          type: "service_order_item_registered",
          title: `Peça registrada na OS #${order.number}`,
          description: `${item.productName} (${item.quantity}x)`,
          severity: "info",
          sourceModule: "service_orders",
          relatedEntityType: "service_order",
          relatedEntityId: order.id,
          metadata: { productName: item.productName, quantity: item.quantity }
        })
      );
    }

    if (order.slaBreachedAt) {
      events.push(
        makeEvent({
          id: `service-order-${order.id}-sla-breached`,
          assetId,
          occurredAt: order.slaBreachedAt,
          category: "service_order",
          type: "service_order_sla_breached",
          title: `SLA da OS #${order.number} vencido`,
          description: "",
          severity: "critical",
          sourceModule: "service_orders",
          relatedEntityType: "service_order",
          relatedEntityId: order.id,
          metadata: { number: order.number, dueAt: order.slaDueAt }
        })
      );
    }

    if (order.reopenedAt) {
      events.push(
        makeEvent({
          id: `service-order-${order.id}-reopened`,
          assetId,
          occurredAt: order.reopenedAt,
          category: "service_order",
          type: "service_order_reopened",
          title: `OS #${order.number} reaberta`,
          description: order.reopenReason || "",
          severity: "warning",
          sourceModule: "service_orders",
          relatedEntityType: "service_order",
          relatedEntityId: order.id,
          metadata: { number: order.number, reopenCount: order.reopenCount }
        })
      );
    }

    if (order.feedback) {
      events.push(
        makeEvent({
          id: `service-order-${order.id}-feedback`,
          assetId,
          occurredAt: order.feedback.submittedAt,
          category: "service_order",
          type: "service_order_feedback_submitted",
          title: `Avaliação recebida na OS #${order.number}`,
          description: order.feedback.comment || `Nota ${order.feedback.rating}/5`,
          severity: order.feedback.rating <= 2 ? "warning" : "success",
          sourceModule: "service_orders",
          actorName: order.feedback.submittedByName || null,
          relatedEntityType: "service_order",
          relatedEntityId: order.id,
          metadata: { number: order.number, rating: order.feedback.rating }
        })
      );
    }
  }
  return events;
}

export function buildAlertEvents(assetId, alerts) {
  const events = [];
  for (const alert of alerts) {
    events.push(
      makeEvent({
        id: `alert-${alert.id}-created`,
        assetId,
        occurredAt: alert.firstSeenAt || alert.createdAt,
        category: "alert",
        type: "alert_created",
        title: alert.title || alert.typeLabel || "Alerta gerado",
        description: alert.description || "",
        severity: alert.severity || "warning",
        sourceModule: "alerts",
        relatedEntityType: "alert",
        relatedEntityId: alert.id,
        metadata: { type: alert.type, value: alert.value, threshold: alert.threshold }
      })
    );

    if (alert.acknowledgement) {
      events.push(
        makeEvent({
          id: `alert-${alert.id}-acknowledged`,
          assetId,
          occurredAt: alert.acknowledgement.acknowledgedAt,
          category: "alert",
          type: "alert_acknowledged",
          title: "Alerta reconhecido",
          description: alert.acknowledgement.note || "",
          severity: "info",
          sourceModule: "alerts",
          actorName: alert.acknowledgement.acknowledgedBy?.name || null,
          relatedEntityType: "alert",
          relatedEntityId: alert.id
        })
      );
    }

    if (alert.status === "resolved" && alert.resolvedAt) {
      events.push(
        makeEvent({
          id: `alert-${alert.id}-resolved`,
          assetId,
          occurredAt: alert.resolvedAt,
          category: "alert",
          type: "alert_resolved",
          title: "Alerta resolvido",
          description: alert.title || "",
          severity: "success",
          sourceModule: "alerts",
          relatedEntityType: "alert",
          relatedEntityId: alert.id
        })
      );
    }
  }
  return events;
}

const REMOTE_ASSISTANCE_EVENT_LABELS = {
  session_requested: "Assistência remota solicitada",
  technician_reauthenticated: "Técnico reautenticado",
  consent_requested: "Consentimento solicitado ao usuário",
  consent_granted: "Consentimento concedido",
  consent_denied: "Consentimento recusado",
  session_started: "Sessão de assistência remota iniciada",
  monitor_changed: "Monitor exibido alterado",
  control_enabled: "Controle remoto ativado",
  control_disabled: "Controle remoto desativado",
  session_ended: "Sessão de assistência remota encerrada",
  viewer_paused: "Visualização pausada",
  viewer_resumed: "Visualização retomada",
  session_failed: "Sessão de assistência remota falhou"
};

export function buildRemoteAssistanceEvents(assetId, events) {
  return events.map((event) =>
    makeEvent({
      id: `remote-assistance-${event.id}`,
      assetId,
      occurredAt: event.createdAt,
      category: "remote_assistance",
      type: event.eventType,
      title: REMOTE_ASSISTANCE_EVENT_LABELS[event.eventType] || event.eventType,
      description: event.message,
      severity: event.eventType === "session_failed" || event.eventType === "consent_denied" ? "warning" : "info",
      sourceModule: "remote_assistance",
      actorName: event.actorName || null,
      relatedEntityType: "remote_assistance_session",
      relatedEntityId: event.sessionId
    })
  );
}

export function buildBackboneEvents(assetId, historyRows) {
  return historyRows
    .filter((row) => !BACKBONE_EXCLUDED_PREFIXES.some((prefix) => row.eventType.startsWith(prefix)))
    .map((row) => {
      const category = resolveBackboneCategory(row.eventType);
      return makeEvent({
        id: `asset-history-${row.id}`,
        assetId,
        occurredAt: row.createdAt,
        category,
        type: row.eventType,
        title: row.message,
        description: [row.oldValue, row.newValue].filter(Boolean).join(" → "),
        severity: resolveBackboneSeverity(row.eventType, category),
        sourceModule: "asset_history",
        actorName: row.userName || null
      });
    });
}

async function resolveCreationEvent(assetId) {
  const manualAsset = await findManualAssetById(assetId);
  if (manualAsset?.createdAt) {
    return makeEvent({
      id: `asset-created-${assetId}`,
      assetId,
      occurredAt: manualAsset.createdAt,
      category: "asset",
      type: "asset_registered",
      title: "Ativo registrado no inventário",
      description: "Máquina adicionada ao inventário manualmente.",
      severity: "neutral",
      sourceModule: "inventory"
    });
  }

  const agentAsset = await findAgentAssetById(assetId);
  if (agentAsset?.createdAt) {
    return makeEvent({
      id: `asset-created-${assetId}`,
      assetId,
      occurredAt: agentAsset.createdAt,
      category: "asset",
      type: "asset_registered",
      title: "Ativo registrado no inventário",
      description: "Máquina adicionada ao inventário pelo agente Windows.",
      severity: "neutral",
      sourceModule: "inventory"
    });
  }

  return null;
}

export function withinPeriod(event, period) {
  if (!period || period === "all") return true;
  const windowMs = PERIOD_TO_MS[period];
  if (!windowMs) return true;
  const occurredAt = new Date(event.occurredAt).getTime();
  if (!Number.isFinite(occurredAt)) return true;
  return Date.now() - occurredAt <= windowMs;
}

export function isImportant(event) {
  return event.severity !== "neutral" && event.severity !== "info";
}

export function buildSummary(events, topologyReferences) {
  return {
    totalEvents: events.length,
    serviceOrdersOpened: events.filter((event) => event.type === "service_order_created").length,
    serviceOrdersClosed: events.filter((event) => event.type === "service_order_closed").length,
    alerts: events.filter((event) => event.type === "alert_created").length,
    criticalAlerts: events.filter((event) => event.type === "alert_created" && event.severity === "critical").length,
    remoteSessions: events.filter((event) => event.type === "session_started").length,
    preventives: events.filter((event) => event.category === "preventive").length,
    hardwareChanges: events.filter((event) => event.category === "hardware").length,
    lastMaintenanceAt: events.find((event) => event.category === "maintenance")?.occurredAt || null,
    networkTopologyMapCount: topologyReferences?.mapCount || 0,
    lastEventAt: events[0]?.occurredAt || null
  };
}

export async function getAssetTechnicalTimeline(assetId, options = {}, user = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const category = options.category && options.category !== "all" ? options.category : null;
  const period = options.period || "all";
  const onlyImportant = String(options.onlyImportant) === "true";

  const canViewRemoteAssistance = hasPermission(user, "remote_assistance.view");

  const [orders, alerts, historyRows, remoteAssistanceEvents, topologyReferences, creationEvent] = await Promise.all([
    listServiceOrdersByAssetId(assetId),
    getHostAlertsWithAcknowledgements(assetId),
    listAssetHistory(assetId),
    canViewRemoteAssistance ? listRemoteAssistanceEventsByAssetId(assetId) : Promise.resolve([]),
    findNetworkTopologyReferencesForAsset(assetId),
    resolveCreationEvent(assetId)
  ]);

  let events = [
    ...buildServiceOrderEvents(assetId, orders),
    ...buildAlertEvents(assetId, alerts),
    ...buildBackboneEvents(assetId, historyRows),
    ...(canViewRemoteAssistance ? buildRemoteAssistanceEvents(assetId, remoteAssistanceEvents) : [])
  ];
  if (creationEvent) events.push(creationEvent);

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const availableCategories = TIMELINE_CATEGORIES.filter((candidate) =>
    events.some((event) => event.category === candidate)
  );

  const summary = buildSummary(events, topologyReferences);

  let filtered = events;
  if (category) filtered = filtered.filter((event) => event.category === category);
  filtered = filtered.filter((event) => withinPeriod(event, period));
  if (onlyImportant) filtered = filtered.filter(isImportant);

  const page = filtered.slice(offset, offset + limit);

  return {
    assetId,
    events: page,
    summary,
    topologyReferences,
    filters: { availableCategories },
    metadata: {
      generatedAt: new Date().toISOString(),
      limit,
      offset,
      total: filtered.length
    }
  };
}
