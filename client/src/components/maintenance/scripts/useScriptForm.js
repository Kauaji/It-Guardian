import { useRef, useState } from "react";
import { applyAnalysisToForm, buildScriptPayload, emptyForm, savedScriptAnalysis, scriptToForm } from "./scriptModel.js";

/** Estado do formulário de cadastro/edição de scripts: análise textual, envio e edição. */
export function useScriptForm({ onAnalyze, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const formRef = useRef(null);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setAnalysis(null);
  }

  function changeContent(value) {
    updateForm("content", value);
    setAnalysis(null);
  }

  async function handleAnalyze() {
    const result = await onAnalyze({ content: form.content, type: form.type });
    setAnalysis(result);
    setForm((current) => applyAnalysisToForm(current, result));
    return result;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const result = analysis || (await handleAnalyze());
      if (!window.confirm("Deseja cadastrar este script com este resumo estimado?")) return;
      await onSave(buildScriptPayload(form, result), editingId);
      resetForm();
    } catch {
      // A mensagem amigável já é exibida pelo App.
    }
  }

  function editScript(script) {
    setEditingId(script.id);
    setForm(scriptToForm(script));
    setAnalysis(savedScriptAnalysis(script));
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return {
    form,
    editingId,
    analysis,
    formRef,
    updateForm,
    resetForm,
    changeContent,
    handleAnalyze,
    handleSubmit,
    editScript
  };
}
