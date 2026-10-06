import { useState } from "react";
import {
  createSegmentGroup as createSegmentGroupApi,
  updateSegmentGroup
} from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { pickUnusedPaletteColor } from "../../components/inventory/inventoryLocalState.js";
import { hasDuplicateGroupName } from "../inventory/segmentGroupRules.js";

// Formulario de criar/renomear grupo de segmentos (modal) e seu envio.
export function useSegmentGroupForm({ data, inventory, meta }) {
  const { token, notify } = useAppSession();
  const { activeInventoryTab, activeSegmentGroups } = inventory.model;
  const { loadData, segmentGroups, setSegmentGroups } = data;
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

    if (hasDuplicateGroupName(activeSegmentGroups, name, segmentGroupForm?.group?.id)) {
      notify("Já existe um grupo com esse nome.", "danger");
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

  return {
    closeSegmentGroupForm,
    openSegmentGroupForm,
    renameSegmentGroup,
    segmentGroupForm,
    segmentGroupSaving,
    submitSegmentGroupForm
  };
}
