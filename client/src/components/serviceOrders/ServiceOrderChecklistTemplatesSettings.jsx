import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createServiceOrderChecklistTemplate,
  deleteServiceOrderChecklistTemplate,
  fetchPublicSupportOptions,
  fetchServiceOrderChecklistTemplates,
  updateServiceOrderChecklistTemplate
} from "../../api.js";

const emptyItem = { label: "", description: "", required: true };

function TemplateEditor({ template, problemTypes, notify, onSaved, onDeleted }) {
  const [name, setName] = useState(template.name);
  const [problemTypeKey, setProblemTypeKey] = useState(template.problemTypeKey || "");
  const [active, setActive] = useState(template.active !== false);
  const [items, setItems] = useState(template.items?.length ? template.items : [{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);

  function updateItem(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((current) => [...current, { ...emptyItem }]);
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function save() {
    if (!name.trim()) {
      notify?.("Informe o nome do template.", "danger");
      return;
    }
    if (!problemTypeKey) {
      notify?.("Selecione o tipo de problema associado.", "danger");
      return;
    }
    const cleanItems = items.map((item) => ({ ...item, label: item.label.trim() })).filter((item) => item.label);
    if (!cleanItems.length) {
      notify?.("Adicione ao menos um item de checklist.", "danger");
      return;
    }
    setSaving(true);
    try {
      const saved = await onSaved({ name: name.trim(), problemTypeKey, active, items: cleanItems }, template.id);
      if (saved) notify?.("Template de checklist salvo.", "success");
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="service-order-checklist-template-card">
      <div className="service-order-checklist-template-header">
        <input
          className="service-order-checklist-template-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do template"
        />
        <select value={problemTypeKey} onChange={(event) => setProblemTypeKey(event.target.value)}>
          <option value="">Tipo de problema...</option>
          {problemTypes.map((problemType) => (
            <option key={problemType.id} value={problemType.id}>{problemType.name}</option>
          ))}
        </select>
        <label className="settings-inline-check">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Ativo
        </label>
      </div>

      <ul className="service-order-checklist-template-items">
        {items.map((item, index) => (
          <li key={index}>
            <input
              placeholder="Item do checklist"
              value={item.label}
              onChange={(event) => updateItem(index, "label", event.target.value)}
            />
            <input
              placeholder="Descrição (opcional)"
              value={item.description || ""}
              onChange={(event) => updateItem(index, "description", event.target.value)}
            />
            <label className="settings-inline-check">
              <input
                type="checkbox"
                checked={Boolean(item.required)}
                onChange={(event) => updateItem(index, "required", event.target.checked)}
              />
              Obrigatório
            </label>
            <button type="button" className="icon-button danger" onClick={() => removeItem(index)} title="Remover item">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="ghost-action compact-action" onClick={addItem}>
        <Plus size={14} />
        Adicionar item
      </button>

      <div className="service-order-checklist-template-actions">
        <button type="button" className="primary-action compact-action" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar template"}
        </button>
        <button type="button" className="ghost-action compact-action danger" onClick={() => onDeleted(template.id)} disabled={saving}>
          <Trash2 size={14} />
          Excluir
        </button>
      </div>
    </article>
  );
}

export default function ServiceOrderChecklistTemplatesSettings({ token, notify }) {
  const [templates, setTemplates] = useState([]);
  const [problemTypes, setProblemTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([fetchServiceOrderChecklistTemplates(token), fetchPublicSupportOptions()])
      .then(([templatesResponse, optionsResponse]) => {
        setTemplates(templatesResponse.templates || []);
        setProblemTypes(optionsResponse.problemTypes || []);
      })
      .catch((error) => notify?.(error.message, "danger"))
      .finally(() => setLoading(false));
  }, [token, notify]);

  async function saveTemplate(payload, id) {
    const response = id
      ? await updateServiceOrderChecklistTemplate(token, id, payload)
      : await createServiceOrderChecklistTemplate(token, payload);
    setTemplates((current) => {
      if (id) return current.map((template) => (template.id === id ? response.template : template));
      return [...current, response.template];
    });
    if (!id) setCreatingNew(false);
    return response.template;
  }

  async function deleteTemplate(id) {
    if (!window.confirm("Excluir este template de checklist?")) return;
    try {
      await deleteServiceOrderChecklistTemplate(token, id);
      setTemplates((current) => current.filter((template) => template.id !== id));
      notify?.("Template removido.", "ok");
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  if (loading) return <p className="loading-message">Carregando templates de checklist...</p>;

  return (
    <section className="service-order-checklist-templates-panel">
      <p className="service-order-checklist-templates-hint">
        Templates são aplicados automaticamente em novas OS cujo tipo de problema corresponda. Configure
        "Exigir checklist para finalizar" na aba SLA para bloquear a finalização até os itens obrigatórios
        estarem marcados.
      </p>

      {templates.map((template) => (
        <TemplateEditor
          key={template.id}
          template={template}
          problemTypes={problemTypes}
          notify={notify}
          onSaved={saveTemplate}
          onDeleted={deleteTemplate}
        />
      ))}

      {creatingNew ? (
        <TemplateEditor
          template={{ id: null, name: "", problemTypeKey: "", active: true, items: [{ ...emptyItem }] }}
          problemTypes={problemTypes}
          notify={notify}
          onSaved={saveTemplate}
          onDeleted={() => setCreatingNew(false)}
        />
      ) : (
        <button type="button" className="secondary-action compact-action" onClick={() => setCreatingNew(true)}>
          <Plus size={16} />
          Novo template de checklist
        </button>
      )}
    </section>
  );
}
