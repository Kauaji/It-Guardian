import { useEffect, useState } from "react";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { createServiceOrderAttachment, deleteServiceOrderAttachment, fetchServiceOrderAttachments } from "../../../api.js";

const CATEGORY_OPTIONS = [
  { value: "evidencia", label: "Evidência" },
  { value: "orcamento", label: "Orçamento" },
  { value: "foto", label: "Foto" },
  { value: "documento", label: "Documento" },
  { value: "print", label: "Print" },
  { value: "outro", label: "Outro" }
];

const emptyForm = { fileName: "", category: "evidencia", description: "", storageKey: "" };

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function ServiceOrderAttachmentsTab({ serviceOrderId, token, notify, canAdd = true, canRemove = true }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!serviceOrderId || !token) return;
    setLoading(true);
    fetchServiceOrderAttachments(token, serviceOrderId)
      .then((response) => setAttachments(response.attachments || []))
      .catch((error) => notify?.(error.message, "danger"))
      .finally(() => setLoading(false));
  }, [serviceOrderId, token, notify]);

  async function submit(event) {
    event.preventDefault();
    if (!form.fileName.trim()) {
      notify?.("Informe o nome do anexo.", "danger");
      return;
    }
    setSaving(true);
    try {
      const response = await createServiceOrderAttachment(token, serviceOrderId, form);
      setAttachments((current) => [response.attachment, ...current]);
      setForm(emptyForm);
      notify?.("Anexo adicionado.", "success");
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function remove(attachment) {
    if (!window.confirm(`Remover o anexo "${attachment.fileName}"?`)) return;
    try {
      await deleteServiceOrderAttachment(token, serviceOrderId, attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }

  return (
    <section className="service-order-attachments-panel">
      <p className="service-order-attachments-limitation">
        Anexos guardam metadados e uma referência (link/descrição) da evidência - não há upload real de arquivo
        nesta versão.
      </p>

      {canAdd && (
        <form className="service-order-attachment-form" onSubmit={submit}>
          <input
            type="text"
            placeholder="Nome do anexo (ex.: foto-fonte.jpg)"
            value={form.fileName}
            onChange={(event) => setForm((current) => ({ ...current, fileName: event.target.value }))}
          />
          <select
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Link ou referência (opcional)"
            value={form.storageKey}
            onChange={(event) => setForm((current) => ({ ...current, storageKey: event.target.value }))}
          />
          <textarea
            placeholder="Descrição (opcional)"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
          <button type="submit" className="primary-action compact-action" disabled={saving}>
            <Plus size={14} />
            {saving ? "Adicionando..." : "Adicionar anexo"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="loading-message">Carregando anexos...</p>
      ) : attachments.length ? (
        <ul className="service-order-attachments-list">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <Paperclip size={15} />
              <div>
                <strong>{attachment.fileName}</strong>
                <span>
                  {CATEGORY_OPTIONS.find((option) => option.value === attachment.category)?.label || attachment.category}
                  {" - "}
                  {formatDate(attachment.uploadedAt)}
                </span>
                {attachment.description && <p>{attachment.description}</p>}
                {attachment.storageKey && <p className="service-order-attachment-reference">{attachment.storageKey}</p>}
              </div>
              {canRemove && (
                <button type="button" className="icon-button danger" onClick={() => remove(attachment)} title="Remover anexo">
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nenhum anexo registrado.</p>
      )}
    </section>
  );
}
