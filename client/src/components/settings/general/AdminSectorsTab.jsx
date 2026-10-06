import { formatDateTime } from "./adminForms.js";
import PermissionChecklist from "./PermissionChecklist.jsx";

function SectorForm({ admin }) {
  const { sectorForm, setSectorForm, resetSectorForm, submitSectorForm, availablePermissionGroups, savingAdmin } = admin;
  const setField = (name, value) => setSectorForm((current) => ({ ...current, [name]: value }));

  return (
    <form className="admin-form-card" onSubmit={submitSectorForm}>
      <div className="admin-form-header">
        <strong>{sectorForm.id ? "Editar setor" : "Novo setor"}</strong>
        {sectorForm.id && (
          <button type="button" className="ghost-action compact-action" onClick={resetSectorForm}>
            Limpar
          </button>
        )}
      </div>
      <label>
        Nome do setor
        <input value={sectorForm.name} onChange={(event) => setField("name", event.target.value)} />
      </label>
      <label>
        Descrição
        <textarea value={sectorForm.description} onChange={(event) => setField("description", event.target.value)} />
      </label>
      <label className="admin-inline-check">
        <input
          type="checkbox"
          checked={sectorForm.active}
          onChange={(event) => setField("active", event.target.checked)}
        />
        Setor ativo
      </label>
      <div className="admin-permission-editor">
        <strong>Permissões padrão do setor</strong>
        <span>Usuários deste setor herdam estas permissões automaticamente.</span>
        <PermissionChecklist
          value={sectorForm.permissions}
          groups={availablePermissionGroups}
          onChange={(permissions) => setField("permissions", permissions)}
        />
      </div>
      <button type="submit" className="primary-action compact-action" disabled={savingAdmin}>
        {savingAdmin ? "Salvando..." : sectorForm.id ? "Salvar setor" : "Criar setor"}
      </button>
    </form>
  );
}

function SectorRecord({ item, admin }) {
  const { editSector, deactivateSector } = admin;
  return (
    <article className={item.active === false ? "inactive" : ""}>
      <div>
        <strong>{item.name}</strong>
        <span>{item.description || "Sem descrição"}</span>
        <small>{item.permissions.length} permissões padrão</small>
      </div>
      <div className="admin-record-meta">
        <span className={item.active === false ? "admin-badge muted" : "admin-badge"}>{item.active === false ? "Inativo" : "Ativo"}</span>
        <small>{formatDateTime(item.updatedAt || item.createdAt)}</small>
      </div>
      <div className="admin-record-actions">
        <button type="button" className="secondary-action compact-action" onClick={() => editSector(item)}>
          Editar
        </button>
        {item.active !== false && (
          <button type="button" className="danger-action compact-action" onClick={() => deactivateSector(item.id)}>
            Desativar
          </button>
        )}
      </div>
    </article>
  );
}

export default function AdminSectorsTab({ admin }) {
  return (
    <div className="admin-settings-grid">
      <SectorForm admin={admin} />
      <div className="admin-record-list">
        {admin.sectors.map((item) => (
          <SectorRecord key={item.id} item={item} admin={admin} />
        ))}
      </div>
    </div>
  );
}
