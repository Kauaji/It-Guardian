import { permissionGroups } from "../../../permissions.js";

export default function PermissionChecklist({ value, onChange, disabled = false, groups = permissionGroups }) {
  const selected = new Set(value || []);

  function toggle(permissionId) {
    if (disabled) return;
    const next = selected.has(permissionId) ? (value || []).filter((item) => item !== permissionId) : [...(value || []), permissionId];
    onChange?.(next);
  }

  return (
    <div className="permission-groups">
      {groups.map((group) => (
        <section key={group.id} className="permission-group-card">
          <strong>{group.label}</strong>
          <div>
            {group.permissions.map((permission) => (
              <label key={permission.id} className="permission-check">
                <input type="checkbox" checked={selected.has(permission.id)} disabled={disabled} onChange={() => toggle(permission.id)} />
                <span>{permission.label}</span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
