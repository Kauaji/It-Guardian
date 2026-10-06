import { useEffect, useMemo, useState } from "react";
import {
  createPublicServiceOrder,
  fetchPublicMachineContext,
  fetchPublicSupportOptions
} from "../../../api.js";
import { validatePublicSupportForm } from "../publicSupportValidation.js";
import {
  buildInitialForm,
  buildRelatedAssetText,
  fallbackCategories,
  fallbackProblemTypes,
  findProblemType,
  getFirstProblemTypeForCategory,
  readMachineContext,
  reconcileFormWithOptions,
  resolveSupportOptions
} from "./publicSupportModel.js";

function useSupportOptions(setForm) {
  const [systemMode, setSystemMode] = useState("local");
  const [options, setOptions] = useState({
    categories: fallbackCategories,
    problemTypes: fallbackProblemTypes
  });

  useEffect(() => {
    let active = true;

    fetchPublicSupportOptions()
      .then((data) => {
        if (!active) return;
        const { categories, problemTypes, systemMode: nextSystemMode } = resolveSupportOptions(data);

        setSystemMode(nextSystemMode);
        setOptions({ categories, problemTypes });
        setForm((current) => reconcileFormWithOptions(current, categories, problemTypes));
      })
      .catch(() => {
        if (active) setOptions({ categories: fallbackCategories, problemTypes: fallbackProblemTypes });
      });

    return () => {
      active = false;
    };
  }, []);

  return { systemMode, options };
}

function useMachineContext(machineContext, setForm) {
  const [machine, setMachine] = useState(null);
  const [machineContextLoading, setMachineContextLoading] = useState(Boolean(machineContext.deviceToken));
  const [machineContextError, setMachineContextError] = useState(false);

  useEffect(() => {
    if (!machineContext.deviceToken) return;
    let active = true;
    fetchPublicMachineContext(machineContext.deviceToken)
      .then(({ machine: resolvedMachine }) => {
        if (!active || !resolvedMachine) return;
        setMachine(resolvedMachine);
        setForm((current) => ({
          ...current,
          assetId: resolvedMachine.id,
          machineScope: "mine",
          machineName: resolvedMachine.name || resolvedMachine.hostname || current.machineName,
          environmentName: resolvedMachine.environmentName || current.environmentName
        }));
      })
      .catch(() => {
        if (active) setMachineContextError(true);
      })
      .finally(() => {
        if (active) setMachineContextLoading(false);
      });
    return () => {
      active = false;
    };
  }, [machineContext.deviceToken]);

  return { machine, machineContextLoading, machineContextError };
}

/** Estado e ações do formulário público de chamado (opções, máquina, validação e envio). */
export function usePublicSupportRequest() {
  const machineContext = useMemo(readMachineContext, []);
  const [form, setForm] = useState(() => buildInitialForm(machineContext));
  const [step, setStep] = useState("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const { systemMode, options } = useSupportOptions(setForm);
  const machineState = useMachineContext(machineContext, setForm);
  const businessMode = systemMode === "business";

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function updateCategory(category) {
    const nextProblemType = getFirstProblemTypeForCategory(options.problemTypes, category);
    setForm((current) => ({
      ...current,
      category,
      problemType: nextProblemType?.name || current.problemType
    }));
    setError("");
  }

  function updateProblemType(value) {
    const nextProblemType = findProblemType(options.problemTypes, value);
    setForm((current) => ({
      ...current,
      problemType: nextProblemType?.name || value,
      category: nextProblemType?.category && options.categories.includes(nextProblemType.category)
        ? nextProblemType.category
        : current.category
    }));
    setError("");
  }

  function goToSummary(event) {
    event.preventDefault();
    const validationError = validatePublicSupportForm(form, { businessMode });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setStep("summary");
  }

  async function confirmSubmit() {
    setError("");
    setLoading(true);

    try {
      const response = await createPublicServiceOrder({
        ...form,
        contactInfo: businessMode ? form.contactInfo : "",
        extension: businessMode ? "" : form.extension,
        relatedAssetText: buildRelatedAssetText(form)
      });
      setSuccess(response.serviceOrder);
    } catch (submitError) {
      setError(submitError.message || "Não foi possível enviar a solicitação.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  return {
    machineContext,
    form,
    options,
    businessMode,
    step,
    setStep,
    loading,
    error,
    success,
    ...machineState,
    updateField,
    updateCategory,
    updateProblemType,
    goToSummary,
    confirmSubmit
  };
}
