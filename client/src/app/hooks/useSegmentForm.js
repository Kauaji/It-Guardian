import { useState } from "react";
import { createSegment, renameSegment } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { isReservedSegmentName, pickSegmentColor } from "../../components/inventory/inventoryLocalState.js";
import {
  assignSegmentToGroup,
  getSegmentGroupId,
  hasDuplicateSegmentName,
  upsertSegmentList
} from "../../components/inventory/inventoryUtils.js";

// Formulario (modal) de criar/renomear segmento e a gravacao correspondente.
export function useSegmentForm({ data, inventory, meta }) {
  const { token, notify } = useAppSession();
  const { filters, model } = inventory;
  const { activeInventoryTab, activeSegmentGroups, activeSegments } = model;
  const { loadData, segmentGroups, setAllDevices, setSegmentGroups, setSegments } = data;
  const [segmentForm, setSegmentForm] = useState(null);
  const [segmentSaving, setSegmentSaving] = useState(false);

  function handleCreateSegment() {
    const selectedGroup = filters.selectedInventoryGroup;
    const groupId = selectedGroup === "all" || selectedGroup === "ungrouped" ? "" : selectedGroup;
    setSegmentForm({ mode: "create", segment: null, groupId });
  }

  function handleRenameSegment(segment) {
    setSegmentForm({ mode: "rename", segment, groupId: segment.groupId || "" });
  }

  function closeSegmentForm() {
    setSegmentForm(null);
  }

  async function renameSegmentFromForm(cleanName, targetGroupId) {
    const response = await renameSegment(token, segmentForm.segment.id, {
      name: cleanName,
      groupId: targetGroupId || null
    });
    setSegmentGroups(assignSegmentToGroup(segmentGroups, segmentForm.segment.id, targetGroupId));
    meta.updateInventoryMeta("segments", segmentForm.segment.id, { tabId: activeInventoryTab.id });
    setSegments((current) =>
      current.map((item) =>
        item.id === segmentForm.segment.id ? { ...item, name: response.segment.name, groupId: response.segment.groupId || "" } : item
      )
    );
    setAllDevices((current) =>
      current.map((device) => (device.segmentId === segmentForm.segment.id ? { ...device, segmentName: response.segment.name } : device))
    );
    notify("Segmento renomeado.", "ok");
  }

  async function createSegmentFromForm(cleanName, targetGroupId) {
    const response = await createSegment(token, {
      name: cleanName,
      color: pickSegmentColor(activeSegments),
      groupId: targetGroupId || null
    });
    const nextSegment = { ...response.segment, groupId: response.segment.groupId || targetGroupId };
    const targetSiblings = activeSegments.filter((segment) => getSegmentGroupId(segment, activeSegmentGroups) === targetGroupId);
    setSegments((current) => upsertSegmentList(current, nextSegment));
    meta.updateInventoryMeta("segments", response.segment.id, {
      tabId: activeInventoryTab.id,
      order: targetSiblings.length
    });
    if (targetGroupId) {
      setSegmentGroups(assignSegmentToGroup(segmentGroups, response.segment.id, targetGroupId));
    }
    notify(`Segmento ${response.segment.name} criado.`, "ok");
  }

  async function submitSegmentForm(name, groupId = "") {
    const cleanName = name.trim();
    const targetGroupId = groupId || "";

    if (isReservedSegmentName(cleanName)) {
      notify("Esse nome e reservado pelo sistema.", "danger");
      return;
    }

    const duplicate = hasDuplicateSegmentName(activeSegments, {
      name: cleanName,
      groupId: targetGroupId,
      excludeId: segmentForm?.segment?.id,
      groups: activeSegmentGroups
    });

    if (duplicate) {
      notify("Já existe um segmento com esse nome neste grupo.", "danger");
      return;
    }

    setSegmentSaving(true);
    try {
      if (segmentForm?.mode === "rename") {
        await renameSegmentFromForm(cleanName, targetGroupId);
      } else {
        await createSegmentFromForm(cleanName, targetGroupId);
      }
      setSegmentForm(null);
      await loadData(true);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSegmentSaving(false);
    }
  }

  return {
    closeSegmentForm,
    handleCreateSegment,
    handleRenameSegment,
    segmentForm,
    segmentSaving,
    submitSegmentForm
  };
}
