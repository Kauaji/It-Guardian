import { useState } from "react";
import {
  createSegmentGroup as createSegmentGroupApi,
  deleteSegmentGroup as deleteSegmentGroupApi,
  updateSegmentGroup
} from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { pickUnusedPaletteColor } from "../../components/inventory/inventoryLocalState.js";
import { getSegmentGroupId, moveIdInList } from "../../components/inventory/inventoryUtils.js";
import { applyOrderedIds } from "../inventory/inventoryMeta.js";

// Grupos de segmentos do inventario: formulario de criar/renomear, cor,
// recolher, excluir e reordenar.
export function useSegmentGroupActions({ data, inventory, meta }) {
  const { token, notify } = useAppSession();
  const { filters, model, persistence } = inventory;
  const { activeInventoryTab, activeSegmentGroups, activeSegments } = model;
  const { loadData, segmentGroups, setSegmentGroups, setSegments } = data;
  const [segmentGroupForm, setSegmentGroupForm] = useState(null);
  const [segmentGroupSaving, setSegmentGroupSaving] = useState(false);

  function openSegmentGroupForm() {
    setSegmentGroupForm({ mode: "create", group: null });
  }

  function renameSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;
    setSegmentGroupForm({ mode: "edit", group });
  }

  function closeSegmentGroupForm() {
    setSegmentGroupForm(null);
  }

  async function submitSegmentGroupForm(name, color) {
    const cleanName = name.trim();
    const nextColor = color || pickUnusedPaletteColor(activeSegmentGroups);
    const duplicate = activeSegmentGroups.some(
      (group) =>
        group.id !== segmentGroupForm?.group?.id &&
        group.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      notify("Ja existe um grupo com esse nome.", "danger");
      return;
    }

    setSegmentGroupSaving(true);
    try {
      if (segmentGroupForm?.mode === "create") {
        const response = await createSegmentGroupApi(token, {
          name: cleanName,
          color: nextColor
        });
        setSegmentGroups([...segmentGroups, response.group]);
        meta.updateInventoryMeta("groups", response.group.id, {
          tabId: activeInventoryTab.id,
          order: activeSegmentGroups.length
        });
        notify("Grupo criado.", "ok");
      } else if (segmentGroupForm?.group?.id) {
        const response = await updateSegmentGroup(token, segmentGroupForm.group.id, {
          name: cleanName,
          color: nextColor
        });
        setSegmentGroups(
          segmentGroups.map((item) =>
            item.id === segmentGroupForm.group.id ? { ...item, ...response.group } : item
          )
        );
        notify("Grupo renomeado.", "ok");
      }

      setSegmentGroupForm(null);
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSegmentGroupSaving(false);
    }
  }

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
      setSegmentGroups(
        segmentGroups.map((item) =>
          item.id === groupId ? { ...item, ...response.group } : item
        )
      );
    } catch (error) {
      setSegmentGroups(segmentGroups);
      notify(error.message, "danger");
    }
  }

  async function deleteSegmentGroup(groupId) {
    const group = activeSegmentGroups.find((item) => item.id === groupId);
    if (!group) return;

    const segmentCount = activeSegments.filter((segment) => getSegmentGroupId(segment, activeSegmentGroups) === groupId).length;
    const confirmed = segmentCount
      ? window.confirm(`Excluir o grupo "${group.name}" e mover ${segmentCount} segmento(s) para Sem grupo?`)
      : window.confirm(`Excluir o grupo "${group.name}"?`);

    if (!confirmed) return;

    try {
      await deleteSegmentGroupApi(token, groupId);
      setSegmentGroups(segmentGroups.filter((item) => item.id !== groupId));
      setSegments((current) =>
        current.map((segment) => (segment.groupId === groupId ? { ...segment, groupId: "" } : segment))
      );

      if (filters.selectedInventoryGroup === groupId) {
        filters.setSelectedInventoryGroup("all");
        filters.setSelectedInventorySegment("all");
      }

      notify("Grupo excluido. Segmentos mantidos em Sem grupo.", "ok");
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  function moveGroupOrder(groupId, direction) {
    const orderedIds = activeSegmentGroups.map((group) => group.id);
    const nextIds = moveIdInList(orderedIds, groupId, direction);
    if (nextIds === orderedIds) return;

    persistence.saveInventoryTabMeta((current) =>
      applyOrderedIds(current, "groups", nextIds, activeInventoryTab.id)
    );
  }

  return {
    changeSegmentGroupColor,
    closeSegmentGroupForm,
    deleteSegmentGroup,
    moveGroupOrder,
    openSegmentGroupForm,
    renameSegmentGroup,
    segmentGroupForm,
    segmentGroupSaving,
    submitSegmentGroupForm,
    toggleSegmentGroup
  };
}
