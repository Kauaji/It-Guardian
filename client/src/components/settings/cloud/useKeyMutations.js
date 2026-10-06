import { useState } from "react";
import {
  createProductKey,
  deactivateProductKeyActivation,
  fetchProductKeyActivations,
  updateProductKeyStatus
} from "../../../api.js";
import { emptyForm } from "./cloudAdminModel.js";

/** Criar chave (com exibição única), copiar, ativar/desativar chave e desativar coletor. */
export function useKeyMutations({
  token,
  showMessage,
  setBusyAction,
  loadProductKeys,
  selectedKeyId,
  setActivations
}) {
  const [form, setForm] = useState(emptyForm);
  const [createdKey, setCreatedKey] = useState(null);

  async function submitProductKey(event) {
    event.preventDefault();
    if (!form.displayName.trim() || !form.organizationName.trim()) {
      showMessage("Informe o nome da chave e a organização.", "danger");
      return;
    }

    setBusyAction("create-key");
    try {
      const response = await createProductKey(token, {
        ...form,
        activationLimit: Number(form.activationLimit),
        expiresAt: form.expiresAt || null
      });
      setCreatedKey({
        value: response.key,
        warning: response.warning,
        productKey: response.productKey
      });
      setForm(emptyForm);
      await loadProductKeys();
      showMessage("Chave de produto criada.");
    } catch (error) {
      showMessage(error.message, "danger");
    } finally {
      setBusyAction("");
    }
  }

  async function copyCreatedKey() {
    if (!createdKey?.value) return;
    try {
      await navigator.clipboard.writeText(createdKey.value);
      showMessage("Chave copiada. Guarde-a em um local seguro.");
    } catch {
      showMessage("Não foi possível copiar automaticamente. Selecione a chave exibida.", "danger");
    }
  }

  async function changeProductKeyStatus(item) {
    if (
      item.active &&
      !window.confirm("Desativar esta chave e todos os coletores vinculados?")
    ) {
      return;
    }
    setBusyAction(`key:${item.id}`);
    try {
      await updateProductKeyStatus(token, item.id, !item.active);
      await loadProductKeys();
      if (selectedKeyId === item.id) {
        const response = await fetchProductKeyActivations(token, item.id);
        setActivations(response.activations || []);
      }
      showMessage(item.active ? "Chave desativada." : "Chave reativada.");
    } catch (error) {
      showMessage(error.message, "danger");
    } finally {
      setBusyAction("");
    }
  }

  async function deactivateActivation(item) {
    if (!window.confirm(`Desativar o coletor de ${item.hostname}?`)) return;
    setBusyAction(`activation:${item.id}`);
    try {
      await deactivateProductKeyActivation(token, item.id);
      const response = await fetchProductKeyActivations(token, selectedKeyId);
      setActivations(response.activations || []);
      await loadProductKeys();
      showMessage("Coletor desativado.");
    } catch (error) {
      showMessage(error.message, "danger");
    } finally {
      setBusyAction("");
    }
  }

  return {
    form,
    setForm,
    createdKey,
    submitProductKey,
    copyCreatedKey,
    changeProductKeyStatus,
    deactivateActivation
  };
}
