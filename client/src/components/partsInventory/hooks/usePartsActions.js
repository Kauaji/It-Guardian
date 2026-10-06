import { useRef, useState } from "react";
import {
  createPartCategory,
  createPartInventoryItem,
  createPartInventoryMovement,
  deletePartCategory,
  fetchPartInventoryItem,
  importPartsInvoice,
  reviewPartInventoryDiscrepancy,
  updatePartInventoryItem
} from "../../../api.js";

// Peca selecionada (inspetor), formulario/categorias abertos e todas as mutacoes do inventario.
// `formPart`: undefined = fechado, null = nova peca, objeto = edicao.
export function usePartsActions({ token, notify, load }) {
  const [selected, setSelected] = useState(null);
  const [formPart, setFormPart] = useState(undefined);
  const [categoryModal, setCategoryModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  // Envolve uma mutacao: marca "salvando", notifica erro e sempre libera o estado ao final.
  async function run(task) {
    setSaving(true);
    try {
      await task();
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function inspect(part) {
    try {
      const data = await fetchPartInventoryItem(token, part.id);
      setSelected(data.part);
    } catch (error) {
      notify?.(error.message, "danger");
    }
  }
  const savePart = (payload) =>
    run(async () => {
      const data = formPart?.id
        ? await updatePartInventoryItem(token, formPart.id, payload)
        : await createPartInventoryItem(token, payload);
      setFormPart(undefined);
      setSelected(data.part);
      notify?.("Peça salva no inventário.", "ok");
      await load();
    });
  const movePart = (payload) =>
    run(async () => {
      const data = await createPartInventoryMovement(token, selected.id, payload);
      setSelected(data.part);
      notify?.("Movimentação registrada no histórico.", "ok");
      await load();
    });
  const reviewDiscrepancy = (action) =>
    run(async () => {
      await reviewPartInventoryDiscrepancy(token, selected.id, action);
      notify?.(action === "dismiss" ? "Incongruência descartada." : "Incongruência mantida para revisão.", "ok");
      setSelected(null);
      await load();
    });
  const addCategory = (name) =>
    run(async () => {
      await createPartCategory(token, { name });
      notify?.("Categoria adicionada.", "ok");
      await load();
    });
  const removeCategory = (id) =>
    run(async () => {
      await deletePartCategory(token, id);
      notify?.("Categoria removida da lista.", "ok");
      await load();
    });
  async function importInvoice(file) {
    if (!file) return;
    setSaving(true);
    try {
      const xml = await file.text();
      const { summary: result } = await importPartsInvoice(token, xml);
      notify?.(`NF-e importada: ${result.created} cadastro(s) e ${result.merged} saldo(s) atualizados.`, "ok");
      await load();
    } catch (error) {
      notify?.(error.message, "danger");
    } finally {
      setSaving(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return {
    selected,
    setSelected,
    formPart,
    setFormPart,
    categoryModal,
    setCategoryModal,
    saving,
    fileInput,
    inspect,
    savePart,
    movePart,
    reviewDiscrepancy,
    addCategory,
    removeCategory,
    importInvoice
  };
}
