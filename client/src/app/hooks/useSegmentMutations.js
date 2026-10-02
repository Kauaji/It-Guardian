import { deleteSegment, renameSegment } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { assignSegmentToGroup, getSegmentGroupId, moveIdInList } from "../../components/inventory/inventoryUtils.js";
import { isMaintenanceSegmentName } from "../../utils/display.js";
import { applyOrderedIds } from "../inventory/inventoryMeta.js";

// Alteracoes de segmentos ja existentes: cor, exclusao, grupo e ordem.
export function useSegmentMutations({ data, deviceState, inventory, meta }) {
  const { token, notify, user } = useAppSession();
  const { model, persistence } = inventory;
  const { activeAllDevices, activeInventoryTab, activeSegmentGroups, activeSegments } = model;
  const { loadData, segmentGroups, setSegmentGroups, setSegments } = data;
  const { saveInventoryTabMeta, saveMaintenanceRecords } = persistence;

  async function handleChangeSegmentColor(segment, color) {
    if (!color || color === segment.color) return;

    const paint = (nextColor) => (item) => (item.id === segment.id ? { ...item, color: nextColor } : item);
    setSegments((current) => current.map(paint(color)));

    try {
      const response = await renameSegment(token, segment.id, { color });
      setSegments((current) => current.map(paint(response.segment.color)));
      await loadData(true);
    } catch (error) {
      setSegments((current) => current.map(paint(segment.color)));
      notify(error.message, "danger");
    }
  }

  // Ao apagar o segmento Manutencao, as maquinas dele voltam para o padrao.
  function releaseMaintenanceMachines(segment, machines) {
    saveMaintenanceRecords((current) => {
      const next = { ...current };
      for (const machine of machines) {
        delete next[machine.id];
      }
      return next;
    });
    const defaultSegment = activeSegments.find((item) => item.isDefault);
    const eventTime = new Date().toISOString();
    for (const machine of machines) {
      deviceState.updateDeviceSegmentInState(machine.id, defaultSegment?.id, defaultSegment?.name || "Não organizadas", {
        maintenance: false,
        maintenanceOrigin: null
      });
      deviceState.appendDeviceHistoryEvent(machine.id, {
        id: `${machine.id}-maintenance-segment-removed-${Date.now()}`,
        createdAt: eventTime,
        userName: user.name,
        eventType: "maintenance",
        message: "Segmento Manutenção removido. Máquina movida para Não organizadas.",
        oldValue: segment.name,
        newValue: defaultSegment?.name || "Não organizadas"
      });
    }
  }

  async function handleDeleteSegment(segment) {
    const confirmed = window.confirm(
      `Excluir o segmento "${segment.name}"? As máquinas vão voltar para Não organizadas.`
    );
    if (!confirmed) return;

    try {
      const wasMaintenanceSegment = isMaintenanceSegmentName(segment.name);
      const affectedMaintenanceMachines = wasMaintenanceSegment
        ? activeAllDevices.filter((device) => device.segmentId === segment.id)
        : [];
      await deleteSegment(token, segment.id);
      setSegmentGroups(assignSegmentToGroup(segmentGroups, segment.id, ""));
      setSegments((current) => current.filter((item) => item.id !== segment.id));
      if (wasMaintenanceSegment && affectedMaintenanceMachines.length) {
        releaseMaintenanceMachines(segment, affectedMaintenanceMachines);
      }
      notify("Segmento excluído. Máquinas movidas para Não organizadas.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function moveSegmentToGroup(segmentId, groupId) {
    const previousGroups = segmentGroups;
    const nextGroups = assignSegmentToGroup(segmentGroups, segmentId, groupId);
    setSegmentGroups(nextGroups.map((group) => (group.id === groupId ? { ...group, collapsed: false } : group)));
    const targetGroupId = groupId || "";
    const targetSiblings = activeSegments.filter(
      (segment) => segment.id !== segmentId && getSegmentGroupId(segment, activeSegmentGroups) === targetGroupId
    );
    meta.updateInventoryMeta("segments", segmentId, {
      tabId: activeInventoryTab.id,
      order: targetSiblings.length
    });
    setSegments((current) =>
      current.map((segment) => (segment.id === segmentId ? { ...segment, groupId: groupId || "" } : segment))
    );
    renameSegment(token, segmentId, { groupId: groupId || null }).catch(async (error) => {
      setSegmentGroups(previousGroups);
      await loadData(true);
      notify(error.message, "danger");
    });
  }

  function moveSegmentOrder(segment, direction) {
    const groupId = getSegmentGroupId(segment, activeSegmentGroups);
    const orderedIds = activeSegments
      .filter((item) => !item.isDefault && getSegmentGroupId(item, activeSegmentGroups) === groupId)
      .map((item) => item.id);
    const nextIds = moveIdInList(orderedIds, segment.id, direction);
    if (nextIds === orderedIds) return;

    saveInventoryTabMeta((current) => applyOrderedIds(current, "segments", nextIds, activeInventoryTab.id));
  }

  return {
    handleChangeSegmentColor,
    handleDeleteSegment,
    moveSegmentOrder,
    moveSegmentToGroup
  };
}
