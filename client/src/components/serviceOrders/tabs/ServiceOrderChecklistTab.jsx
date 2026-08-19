import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { fetchServiceOrderChecklist, updateServiceOrderChecklistItem } from "../../../api.js";

export default function ServiceOrderChecklistTab({ serviceOrderId, token, notify, canManage = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (!serviceOrderId || !token) return;
    setLoading(true);
    fetchServiceOrderChecklist(token, serviceOrderId)
      .then((response) => setItems(response.items || []))
      .catch((error) => notify?.(error.message, "danger"))
      .finally(() => setLoading(false));
  }, [serviceOrderId, token, notify]);

  async function toggleItem(item, checked) {
    setSavingId(item.id);
    try {
      const response = await updateServiceOrderChecklistItem(token, serviceOrderId, item.id, {
        checked,
        notes: item.notes
      });
      setItems(response.items || []);
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSavingId(null);
    }
  }

  async function saveNotes(item, notes) {
    try {
      const response = await updateServiceOrderChecklistItem(token, serviceOrderId, item.id, {
        checked: item.checked,
        notes
      });
      setItems(response.items || []);
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  if (loading) return <p className="loading-message">Carregando checklist...</p>;

  if (!items.length) {
    return (
      <section className="service-order-checklist-panel">
        <p className="empty">
          Nenhum checklist aplicado a esta OS. Configure um template de checklist para o tipo de problema nas
          configurações de OS para que ele seja aplicado automaticamente em novas ordens.
        </p>
      </section>
    );
  }

  const completed = items.filter((item) => item.checked).length;

  return (
    <section className="service-order-checklist-panel">
      <div className="service-order-checklist-summary">
        <ListChecks size={16} />
        <span>{completed} de {items.length} itens concluídos</span>
      </div>
      <ul className="service-order-checklist-list">
        {items.map((item) => (
          <li key={item.id} className={item.checked ? "checked" : ""}>
            <label>
              <input
                type="checkbox"
                checked={item.checked}
                disabled={!canManage || savingId === item.id}
                onChange={(event) => toggleItem(item, event.target.checked)}
              />
              <span>
                {item.label}
                {item.required && <em title="Obrigatório"> *</em>}
              </span>
            </label>
            {item.description && <p className="service-order-checklist-item-description">{item.description}</p>}
            <textarea
              className="service-order-checklist-item-notes"
              placeholder="Observação (opcional)"
              defaultValue={item.notes || ""}
              disabled={!canManage}
              onBlur={(event) => {
                if (event.target.value !== (item.notes || "")) saveNotes(item, event.target.value);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
