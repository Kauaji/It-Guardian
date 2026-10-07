import { useState } from "react";
import { createUser, deleteUser, updateUserAccess } from "../../../api.js";
import { buildUserPayload, emptyUserForm, upsertRecord, userToForm, validateUserForm } from "./adminForms.js";

/** Formulário e ações de usuários da aba Admin (criar, editar, excluir). */
export function useUserAdmin({ token, notify, setUsers, setSaving }) {
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [userPermissionsOpen, setUserPermissionsOpen] = useState(false);

  function resetUserForm() {
    setUserForm(emptyUserForm());
    setUserPermissionsOpen(false);
  }

  function editUser(item) {
    setUserPermissionsOpen(false);
    setUserForm(userToForm(item));
  }

  async function submitUserForm(event) {
    event.preventDefault();

    const validationError = validateUserForm(userForm);
    if (validationError) {
      notify(validationError, "danger");
      return;
    }

    setSaving(true);
    try {
      const payload = buildUserPayload(userForm);
      const response = userForm.id
        ? await updateUserAccess(token, userForm.id, payload)
        : await createUser(token, { ...payload, password: userForm.password });

      setUsers((current) => upsertRecord(current, response.user, Boolean(userForm.id)));
      resetUserForm();
      notify(userForm.id ? "Usuário atualizado." : "Usuário criado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateUser(id) {
    if (!window.confirm("Tem certeza que deseja excluir este usuário? Essa ação não poderá ser desfeita.")) return;

    setSaving(true);
    try {
      const response = await deleteUser(token, id);
      setUsers((current) => current.map((item) => (item.id === id ? response.user : item)));
      if (userForm.id === id) resetUserForm();
      notify("Usuário excluído.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  return {
    userForm,
    setUserForm,
    userPermissionsOpen,
    setUserPermissionsOpen,
    resetUserForm,
    editUser,
    submitUserForm,
    deactivateUser
  };
}
