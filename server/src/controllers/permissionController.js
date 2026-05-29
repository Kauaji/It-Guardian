import { allPermissionIds, permissionGroups } from "../permissions.js";

export function list(_req, res) {
  res.json({
    permissionGroups,
    permissions: allPermissionIds
  });
}
