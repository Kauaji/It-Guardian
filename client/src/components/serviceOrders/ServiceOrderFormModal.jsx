import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { fetchClients, fetchTechnicians } from "../../api.js";
import { assetTypeLabel } from "../inventory/assetTypes.js";

const priorities = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" }
];

export default function ServiceOrderFormModal({
  open,
  devices = [],
  tabs = [],
  activeTab,
  token,
  notify,
  systemMode = "local",
  serviceOrderSettings,
  sectors = [],
  saving,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    assetId: "",
    environmentId: "",
    requesterName: "",
    assignedTechnicianName: "",
    sectorId: "sector-geral",
    autoPriorityEnabled: Boolean(serviceOrderSettings?.autoPriority?.enabled),
    category: "",
    notes: ""
  });
  const [technicians, setTechnicians] = useState([]);
  const [clients, setClients] = useState([]);
  const [formError, setFormError] = useState("");
  const businessMode = systemMode === "business";
  const environmentLabel = businessMode ? "Cliente" : "Ambiente";
  const helperText = businessMode
    ? "No modo Business, informe cliente/ambiente, ativo, solicitante, categoria e descrição."
    : "No modo Local, o setor organiza o atendimento interno sem exigir cliente.";

  useEffect(() => {
    if (!open) return;
    setFormError("");
    setForm((current) => ({
      ...current,
      environmentId: businessMode ? "" : activeTab?.id || "",
      title: "",
      description: "",
      priority: "medium",
      assetId: "",
      requesterName: "",
      assignedTechnicianName: "",
      sectorId: "sector-geral",
      autoPriorityEnabled: Boolean(serviceOrderSettings?.autoPriority?.enabled),
      category: "",
      notes: ""
    }));
  }, [activeTab?.id, businessMode, open, serviceOrderSettings?.autoPriority?.enabled]);

  useEffect(() => {
    if (!open || !token) return;

    fetchTechnicians(token)
      .then((response) => setTechnicians((response.technicians || []).filter((item) => item.active !== false)))
      .catch((error) => notify?.(error.message, "danger"));

    if (businessMode) {
      fetchClients(token)
        .then((response) => setClients((response.clients || []).filter((item) => item.active !== false)))
        .catch((error) => notify?.(error.message, "danger"));
    } else {
      setClients([]);
    }
  }, [businessMode, open, token]);

  const selectedAsset = useMemo(
    () => devices.find((device) => device.id === form.assetId),
    [devices, form.assetId]
  );
  const selectedEnvironment = tabs.find((tab) => tab.id === form.environmentId) || activeTab;
  const selectedClient = clients.find((client) => client.id === form.environmentId);
  const availableSectors = sectors.length ? sectors : [{ id: "sector-geral", name: "Geral" }];
  const selectedSector = availableSectors.find((sector) => sector.id === form.sectorId)
    || availableSectors.find((sector) => sector.name === "Geral")
    || availableSectors[0];

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
  }

  function submit(event) {
    event.preventDefault();
    const title = form.title.trim();
    const description = form.description.trim();
    const requesterName = form.requesterName.trim();
    const category = form.category.trim();

    if (saving) return;

    if (title.length < 3) {
      setFormError("Informe um título com pelo menos 3 caracteres.");
      return;
    }

    if (businessMode) {
      if (!selectedClient) {
        setFormError("No modo Business, selecione um cliente para abrir a Ordem de Serviço.");
        return;
      }
      if (!form.assetId) {
        setFormError("No modo Business, vincule uma máquina/ativo à OS.");
        return;
      }
      if (!requesterName) {
        setFormError("No modo Business, informe o solicitante.");
        return;
      }
      if (!category) {
        setFormError("No modo Business, informe a categoria da OS.");
        return;
      }
      if (!description) {
        setFormError("No modo Business, descreva a solicitação.");
        return;
      }
    } else if (!description || !category || !requesterName) {
      setFormError("Informe descrição, categoria e solicitante para criar a OS.");
      return;
    }

    onSubmit({
      ...form,
      title,
      description,
      requesterName,
      assignedTechnicianName: form.assignedTechnicianName.trim(),
      category,
      notes: form.notes.trim(),
      sectorId: selectedSector?.id || "sector-geral",
      sectorName: selectedSector?.name || "Geral",
      environmentName: businessMode
        ? selectedClient?.tradeName || selectedClient?.legalName || ""
        : selectedEnvironment?.name || ""
    });
  }

  return (
    <div className="modal-backdrop service-order-backdrop" role="presentation">
      <form className="modal-panel service-order-form-modal" role="dialog" aria-modal="true" onSubmit={submit}>
        <header>
          <div>
            <h2>Nova Ordem de Serviço</h2>
            <p>{helperText}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <label className="service-order-wide">
          Título/resumo
          <input
            autoFocus
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Ex: Computador do financeiro não inicia"
          />
        </label>

        <label className="service-order-wide">
          Descrição do problema
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="Descreva o problema informado pelo usuário ou técnico."
          />
        </label>

        <label>
          Prioridade
          <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
            {priorities.map((priority) => (
              <option key={priority.value} value={priority.value}>{priority.label}</option>
            ))}
          </select>
        </label>

        <label>
          Categoria
          <input
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            placeholder="Hardware, rede, impressora..."
          />
        </label>

        <label>
          Setor
          <select value={form.sectorId} onChange={(event) => updateField("sectorId", event.target.value || "sector-geral")}>
            {availableSectors.map((sector) => (
              <option key={sector.id} value={sector.id}>{sector.name}</option>
            ))}
          </select>
        </label>

        <label>
          {environmentLabel}
          <select value={form.environmentId} onChange={(event) => updateField("environmentId", event.target.value)}>
            <option value="">{businessMode ? "Selecione um cliente" : "Sem ambiente definido"}</option>
            {(businessMode ? clients : tabs).map((item) => (
              <option key={item.id} value={item.id}>
                {businessMode ? item.tradeName || item.legalName : item.name || "Novo ambiente"}
              </option>
            ))}
          </select>
        </label>

        <label>
          Máquina/ativo{businessMode ? "" : " (quando possível)"}
          <select value={form.assetId} onChange={(event) => updateField("assetId", event.target.value)}>
            <option value="">Sem ativo vinculado</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} - {device.ip}
              </option>
            ))}
          </select>
        </label>

        {selectedAsset && (
          <div className="service-order-asset-preview service-order-wide">
            <strong>{selectedAsset.name}</strong>
            <span>{selectedAsset.ip} - {assetTypeLabel(selectedAsset.assetType)} - {selectedAsset.segmentName}</span>
          </div>
        )}

        <label>
          Solicitante
          <input
            value={form.requesterName}
            onChange={(event) => updateField("requesterName", event.target.value)}
            placeholder="Nome do solicitante"
          />
        </label>

        <label>
          Técnico responsável{businessMode ? " (necessário para avançar status)" : " (opcional no início)"}
          {technicians.length ? (
            <select
              value={form.assignedTechnicianName}
              onChange={(event) => updateField("assignedTechnicianName", event.target.value)}
            >
              <option value="">Sem técnico definido</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.name}>{technician.name}</option>
              ))}
            </select>
          ) : (
            <div className="service-order-inline-empty">Não existem técnicos cadastrados. Cadastre técnicos nas Configurações da OS.</div>
          )}
        </label>

        <label className="service-order-wide">
          Observações iniciais
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Contexto adicional, combinados ou restrições."
          />
        </label>

        {formError && <div className="service-order-form-error service-order-wide">{formError}</div>}

        <div className="modal-actions service-order-wide">
          <button type="button" className="ghost-action" onClick={onClose}>Cancelar</button>
          <button className="primary-action compact-action" disabled={saving || form.title.trim().length < 3}>
            {saving ? "Criando..." : "Criar OS"}
          </button>
        </div>
      </form>
    </div>
  );
}
