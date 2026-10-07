// Formulários de usuário e setor (valores iniciais, conversões e validações), sem React.

export const roleLabels = {
  admin: "Admin",
  operator: "Operador",
  viewer: "Visualizador"
};

export function emptyUserForm() {
  return {
    id: "",
    name: "",
    email: "",
    password: "",
    role: "viewer",
    active: true,
    sectorId: "",
    jobTitle: "",
    permissions: []
  };
}

export function emptySectorForm() {
  return {
    id: "",
    name: "",
    description: "",
    active: true,
    permissions: []
  };
}

export function userToForm(item) {
  return {
    id: item.id,
    name: item.name || "",
    email: item.email || "",
    password: "",
    role: item.isAdmin ? "admin" : item.role || "operator",
    active: item.active !== false,
    sectorId: item.sectorId || "",
    jobTitle: item.jobTitle || "",
    permissions: item.permissions || []
  };
}

export function sectorToForm(item) {
  return {
    id: item.id,
    name: item.name || "",
    description: item.description || "",
    active: item.active !== false,
    permissions: item.permissions || []
  };
}

/** Devolve a mensagem de erro do formulário de usuário, ou "" quando válido. */
export function validateUserForm(form) {
  if (!form.name.trim() || !form.email.trim()) {
    return "Informe nome e e-mail do usuário.";
  }
  if (!form.id && form.password.length < 12) {
    return "Informe uma senha temporária com pelo menos 12 caracteres. A pessoa troca no primeiro acesso.";
  }
  return "";
}

export function buildUserPayload(form) {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    role: form.role,
    active: form.active,
    sectorId: form.sectorId || null,
    jobTitle: form.jobTitle.trim(),
    permissions: form.role === "admin" ? [] : form.permissions
  };
}

export function buildSectorPayload(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    active: form.active,
    permissions: form.permissions
  };
}

/** Troca o item de mesmo id (update) ou coloca o novo no topo (create). */
export function upsertRecord(list, record, replacing) {
  if (replacing) {
    return list.map((item) => (item.id === record.id ? record : item));
  }
  return [record, ...list];
}

export function formatDateTime(value) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
