import { useEffect, useState } from "react";
import { fetchPermissions, fetchSectors, fetchUsers } from "../../../api.js";
import { permissionGroups } from "../../../permissions.js";
import { useSectorAdmin } from "./useSectorAdmin.js";
import { useUserAdmin } from "./useUserAdmin.js";

/** Dados e ações da aba Admin: carrega usuários/setores/permissões e compõe os formulários. */
export function useAdminSettings({ open, section, token, isAdmin, notify }) {
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [availablePermissionGroups, setAvailablePermissionGroups] = useState(permissionGroups);
  const [adminTab, setAdminTab] = useState("users");
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const userAdmin = useUserAdmin({ token, notify, setUsers, setSaving: setSavingAdmin });
  const sectorAdmin = useSectorAdmin({ token, notify, setSectors, setSaving: setSavingAdmin });

  async function loadAdminData() {
    setLoadingAdmin(true);
    try {
      const [usersResponse, sectorsResponse, permissionsResponse] = await Promise.all([
        fetchUsers(token),
        fetchSectors(token),
        fetchPermissions(token)
      ]);
      setUsers(usersResponse.users || []);
      setSectors(sectorsResponse.sectors || []);
      setAvailablePermissionGroups(permissionsResponse.permissionGroups || permissionGroups);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setLoadingAdmin(false);
    }
  }

  useEffect(() => {
    if (!open || section !== "admin" || !token || !isAdmin) return;
    loadAdminData();
  }, [open, section, token, isAdmin]);

  function editUser(item) {
    setAdminTab("users");
    userAdmin.editUser(item);
  }

  function editSector(item) {
    setAdminTab("sectors");
    sectorAdmin.editSector(item);
  }

  return {
    users,
    sectors,
    availablePermissionGroups,
    adminTab,
    setAdminTab,
    loadingAdmin,
    savingAdmin,
    ...userAdmin,
    editUser,
    ...sectorAdmin,
    editSector
  };
}
