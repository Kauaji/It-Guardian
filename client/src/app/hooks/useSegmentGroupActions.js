import { deleteSegmentGroup as deleteSegmentGroupApi, updateSegmentGroup } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { moveIdInList } from "../../components/inventory/inventoryUtils.js";
import { applyOrderedIds } from "../inventory/inventoryMeta.js";
import { countSegmentsInGroup, deleteGroupConfirmation } from "../inventory/segmentGroupRules.js";
import { useSegmentGroupForm } from "./useSegmentGroupForm.js";

// Grupos de segmentos do inventario: formulario de criar/renomear (useSegmentGroupForm),
// cor, recolher, excluir e reordenar.
export function useSegmentGroupActions({ data, inventory, meta }) {
  const { token, notify } = useAppSession();
  const { filters, model, persistence } = inventory;
  const { activeInventoryTab, activeSegmentGroups, activeSegments } = model;
  const { loadData, segmentGroups, setSegmentGroups, setSegments } = data;
  const form = useSegmentGroupForm({ data, inventory, meta });

  function toggleSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;

    const collapsed = !group.collapsed;
    setSegmentGroups(segmentGroups.map((item) => (item.id === groupId ? { ...item, collapsed } : item)));
    updateSegmentGroup(token, groupId, { collapsed }).catch((error) => notify(error.message, "danger"));
  }

  async function changeSegmentGroupColor(groupId, color) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group || !color || group.color === color) return;

    setSegmentGroups(segmentGroups.map((item) => (item.id === groupId ? { ...item, color } : item)));

    try {
      const response = await updateSegmentGroup(token, groupId, { color });
      setSegmentGroups(segmentGroups.map((item) => (item.id === groupId ? { ...item, ...response.group } : item)));
    } catch (error) {
      setSegmentGroups(segmentGroups);
      notify(error.message, "danger");
    }
  }

  async function deleteSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;

    const segmentCount = countSegmentsInGroup(activeSegments, activeSegmentGroups, groupId);
    if (!window.confirm(deleteGroupConfirmation(group, segmentCount))) return;

    try {
      await deleteSegmentGroupApi(token, groupId);
      setSegmentGroups(segmentGroups.filter((item) => item.id !== groupId));
      setSegments((current) => current.map((segment) => (segment.groupId === groupId ? { ...segment, groupId: "" } : segment)));

      if (filters.selectedInventoryGroup === groupId) {
        filters.setSelectedInventoryGroup("all");
        filters.setSelectedInventorySegment("all");
      }

      notify("Grupo excluído. Segmentos mantidos em Sem grupo.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function moveGroupOrder(groupId, direction) {
    const orderedIds = activeSegmentGroups.map((group) => group.id);
    const nextIds = moveIdInList(orderedIds, groupId, direction);
    if (nextIds === orderedIds) return;

    persistence.saveInventoryTabMeta((current) => applyOrderedIds(current, "groups", nextIds, activeInventoryTab.id));
  }

  return {
    changeSegmentGroupColor,
    closeSegmentGroupForm: form.closeSegmentGroupForm,
    deleteSegmentGroup,
    moveGroupOrder,
    openSegmentGroupForm: form.openSegmentGroupForm,
    renameSegmentGroup: form.renameSegmentGroup,
    segmentGroupForm: form.segmentGroupForm,
    segmentGroupSaving: form.segmentGroupSaving,
    submitSegmentGroupForm: form.submitSegmentGroupForm,
    toggleSegmentGroup
  };
}
