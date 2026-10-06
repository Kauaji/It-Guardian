import { useEffect, useMemo, useRef, useState } from "react";
import { fetchClients } from "../../../api.js";
import { configs, visibleByMode } from "./settingsConfigs.js";

/** Filtra os registros por qualquer valor que contenha o termo (sem diferenciar maiúsculas). */
export function filterRecords(records, search) {
  const term = search.trim().toLowerCase();
  if (!term) return records;
  return records.filter((record) =>
    Object.values(record).some((value) => String(value || "").toLowerCase().includes(term))
  );
}

/** Mensagem do resultado de uma importação CSV e o tom do aviso. */
export function importSummary(response) {
  const errorCount = response.errors?.length || 0;
  return {
    message: `${response.imported} registros importados. ${errorCount} erros.`,
    type: errorCount ? "danger" : "ok"
  };
}

/** Estado, carga e ações (criar, editar, excluir, importar) de um cadastro auxiliar. */
export function useSettingsRecords({ token, notify, systemMode, forcedSection }) {
  const [internalSectionId, setInternalSectionId] = useState(forcedSection || "clients");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const sectionId = forcedSection || internalSectionId;
  const config = configs[sectionId];
  const businessMode = systemMode === "business";
  const visibleColumns = visibleByMode(config.columns, businessMode);

  const filteredRecords = useMemo(() => filterRecords(records, search), [records, search]);

  async function loadRecords() {
    try {
      const response = await config.fetch(token, { search });
      setRecords(response[sectionId] || response[config.plural] || []);
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  async function loadClientOptions() {
    if (!businessMode || sectionId !== "technicians") return;
    try {
      const response = await fetchClients(token);
      setClientOptions((response.clients || []).filter((client) => client.active !== false));
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  useEffect(() => {
    loadRecords();
  }, [sectionId]);

  useEffect(() => {
    loadClientOptions();
  }, [businessMode, sectionId]);

  useEffect(() => {
    if (!forcedSection) return;
    setSearch("");
    setEditingRecord(null);
    setFormOpen(false);
  }, [forcedSection]);

  function selectSection(id) {
    setInternalSectionId(id);
    setSearch("");
  }

  function openCreate() {
    setEditingRecord(null);
    setFormOpen(true);
  }

  function openEdit(record) {
    setEditingRecord(record);
    setFormOpen(true);
  }

  async function saveRecord(payload) {
    setSaving(true);
    try {
      if (editingRecord) {
        await config.update(token, editingRecord.id, payload);
        notify?.("Cadastro atualizado.", "ok");
      } else {
        await config.create(token, payload);
        notify?.("Cadastro criado.", "ok");
      }

      setFormOpen(false);
      await loadRecords();
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(record) {
    const name = record[config.titleField] || config.singular;
    if (!window.confirm(`Excluir "${name}"?`)) return;

    try {
      await config.remove(token, record.id);
      notify?.("Cadastro excluído.", "ok");
      await loadRecords();
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      notify?.("Por enquanto a importação aceita CSV. Excel ficará preparado para uma próxima etapa.", "danger");
      return;
    }

    try {
      const csv = await file.text();
      const response = await config.importCsv(token, csv);
      const summary = importSummary(response);
      notify?.(summary.message, summary.type);
      await loadRecords();
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  return {
    sectionId,
    config,
    businessMode,
    visibleColumns,
    search,
    setSearch,
    filteredRecords,
    records,
    clientOptions,
    editingRecord,
    formOpen,
    setFormOpen,
    saving,
    fileInputRef,
    selectSection,
    openCreate,
    openEdit,
    saveRecord,
    removeRecord,
    importFile
  };
}
