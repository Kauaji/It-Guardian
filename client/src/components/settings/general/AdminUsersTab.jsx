import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import UserSecurityActions from "../UserSecurityActions.jsx";
import { formatDateTime, roleLabels } from "./adminForms.js";
import PermissionChecklist from "./PermissionChecklist.jsx";

function UserForm({ admin }) {
  const {
    userForm,
    setUserForm,
    userPermissionsOpen,
    setUserPermissionsOpen,
    resetUserForm,
    submitUserForm,
    sectors,
    availablePermissionGroups,
    savingAdmin
  } = admin;
  const setField = (name, value) => setUserForm((current) => ({ ...current, [name]: value }));

  return (
    <form className="admin-form-card" onSubmit={submitUserForm}>
      <div className="admin-form-header">
        <strong>{userForm.id ? "Editar usuário" : "Novo usuário"}</strong>
        {userForm.id && (
          <button type="button" className="ghost-action compact-action" onClick={resetUserForm}>
            Limpar
          </button>
        )}
      </div>
      <div className="admin-form-grid">
        <label>
          Nome
          <input value={userForm.name} onChange={(event) => setField("name", event.target.value)} />
        </label>
        <label>
          E-mail
          <input value={userForm.email} onChange={(event) => setField("email", event.target.value)} />
        </label>
        {!userForm.id && (
          <label>
            Senha temporária
            <input
              type="password"
              autoComplete="new-password"
              value={userForm.password}
              onChange={(event) => setField("password", event.target.value)}
              placeholder="Mínimo 12 caracteres"
            />
          </label>
        )}
        <label>
          Setor
          <select value={userForm.sectorId} onChange={(event) => setField("sectorId", event.target.value)}>
            <option value="">Sem setor</option>
            {sectors
              .filter((sector) => sector.active !== false)
              .map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Funcao/cargo
          <input value={userForm.jobTitle} onChange={(event) => setField("jobTitle", event.target.value)} />
        </label>
        <label>
          Perfil
          <select value={userForm.role} onChange={(event) => setField("role", event.target.value)}>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="admin-inline-check">
        <input type="checkbox" checked={userForm.active} onChange={(event) => setField("active", event.target.checked)} />
        Usuário ativo
      </label>
      <section className={`admin-form-collapsible${userPermissionsOpen ? " open" : ""}`}>
        <button
          type="button"
          className="admin-form-collapsible-trigger"
          aria-expanded={userPermissionsOpen}
          onClick={() => setUserPermissionsOpen((current) => !current)}
        >
          <span>
            <strong>Permissões individuais</strong>
            <small>Somam com as permissões herdadas do setor.</small>
          </span>
          {userPermissionsOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {userPermissionsOpen && (
          <div className="admin-permission-editor">
            <span>Administradores sempre possuem acesso total.</span>
            <PermissionChecklist
              value={userForm.permissions}
              groups={availablePermissionGroups}
              disabled={userForm.role === "admin"}
              onChange={(permissions) => setField("permissions", permissions)}
            />
          </div>
        )}
      </section>
      <button type="submit" className="primary-action compact-action" disabled={savingAdmin}>
        {savingAdmin ? "Salvando..." : userForm.id ? "Salvar usuário" : "Criar usuário"}
      </button>
    </form>
  );
}

function UserRecord({ item, admin, token, currentUser, notify }) {
  const { savingAdmin, editUser, deactivateUser } = admin;
  return (
    <article className={item.active === false ? "inactive" : ""}>
      <div>
        <strong>{item.name}</strong>
        <small>
          {roleLabels[item.role] || item.role}
          {item.sectorName ? ` - ${item.sectorName}` : ""}
          {item.jobTitle ? ` - ${item.jobTitle}` : ""}
        </small>
      </div>
      <div className="admin-record-meta">
        <span className={item.active === false ? "admin-badge muted" : "admin-badge"}>{item.active === false ? "Inativo" : "Ativo"}</span>
        {item.isAdmin && <span className="admin-badge accent">Admin</span>}
        <small>{formatDateTime(item.updatedAt || item.createdAt)}</small>
      </div>
      <div className="admin-record-actions">
        <button type="button" className="secondary-action compact-action" onClick={() => editUser(item)}>
          Editar
        </button>
        <UserSecurityActions token={token} target={item} currentUserId={currentUser?.id} disabled={savingAdmin} notify={notify} />
        <button
          type="button"
          className="danger-action compact-action icon-only"
          onClick={() => deactivateUser(item.id)}
          disabled={savingAdmin || item.active === false}
          title="Excluir usuário"
          aria-label={`Excluir usuário ${item.name}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

export default function AdminUsersTab({ admin, token, currentUser, notify }) {
  return (
    <div className="admin-settings-grid">
      <UserForm admin={admin} />
      <div className="admin-record-list">
        {admin.users.map((item) => (
          <UserRecord key={item.id} item={item} admin={admin} token={token} currentUser={currentUser} notify={notify} />
        ))}
      </div>
    </div>
  );
}
