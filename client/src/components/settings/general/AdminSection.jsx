import { UserCog } from "lucide-react";
import CloudProductAdminPanel from "../CloudProductAdminPanel.jsx";
import AdminSectorsTab from "./AdminSectorsTab.jsx";
import AdminUsersTab from "./AdminUsersTab.jsx";
import PermissionChecklist from "./PermissionChecklist.jsx";

const adminTabs = [
  { id: "users", label: "Usuários" },
  { id: "sectors", label: "Setores" },
  { id: "permissions", label: "Permissões" },
  { id: "cloud", label: "Cloud e coletores" }
];

function PermissionsOverview({ groups }) {
  return (
    <div className="admin-permissions-overview">
      <p>Permissões são validadas no frontend para exibir menus e no backend para bloquear chamadas diretas de API.</p>
      <PermissionChecklist
        value={groups.flatMap((group) => group.permissions.map((permission) => permission.id))}
        groups={groups}
        disabled
      />
    </div>
  );
}

export default function AdminSection({ admin, token, user, notify }) {
  const { adminTab, setAdminTab, loadingAdmin, availablePermissionGroups } = admin;
  return (
    <div className="general-settings-section admin-settings-section">
      <UserCog size={22} />
      <h3>Admin</h3>
      <p>Gerencie usuários, setores e permissões da empresa atual.</p>

      <div className="admin-settings-tabs" role="tablist" aria-label="Administração">
        {adminTabs.map((tab) => (
          <button key={tab.id} type="button" className={adminTab === tab.id ? "active" : ""} onClick={() => setAdminTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {loadingAdmin && <p className="empty">Carregando administração...</p>}

      {adminTab === "users" && <AdminUsersTab admin={admin} token={token} currentUser={user} notify={notify} />}
      {adminTab === "sectors" && <AdminSectorsTab admin={admin} />}
      {adminTab === "permissions" && <PermissionsOverview groups={availablePermissionGroups} />}
      {adminTab === "cloud" && <CloudProductAdminPanel token={token} notify={notify} />}
    </div>
  );
}
