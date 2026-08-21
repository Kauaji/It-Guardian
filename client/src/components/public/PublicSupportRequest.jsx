import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  createPublicServiceOrder,
  fetchPublicMachineContext,
  fetchPublicSupportOptions
} from "../../api.js";
import { honeypotFieldName, validatePublicSupportForm } from "./publicSupportValidation.js";
import PublicSupportForm from "./PublicSupportForm.jsx";
import PublicSupportSummary from "./PublicSupportSummary.jsx";
import PublicSupportSuccess from "./PublicSupportSuccess.jsx";

const fallbackCategories = [
  "Computador",
  "Notebook",
  "Servidor",
  "Impressora",
  "Teclado",
  "Mouse",
  "Monitor",
  "Rede",
  "Sistema",
  "Outro"
];

const fallbackProblemTypes = [
  { id: "computer-power", name: "Computador não liga", category: "Computador", defaultPriority: "high" },
  { id: "printer", name: "Impressora não imprime", category: "Impressora", defaultPriority: "medium" },
  { id: "network", name: "Internet lenta", category: "Rede", defaultPriority: "medium" },
  { id: "system", name: "Sistema travando", category: "Sistema", defaultPriority: "medium" },
  { id: "monitor", name: "Monitor sem imagem", category: "Monitor", defaultPriority: "medium" },
  { id: "keyboard", name: "Teclado com defeito", category: "Teclado", defaultPriority: "low" },
  { id: "mouse", name: "Mouse com defeito", category: "Mouse", defaultPriority: "low" }
];

function findProblemType(problemTypes, value) {
  return problemTypes.find(
    (problemType) => problemType.name === value || problemType.id === value
  );
}

function getFirstProblemTypeForCategory(problemTypes, category) {
  return problemTypes.find((problemType) => !problemType.category || problemType.category === category) ||
    problemTypes[0];
}

function readMachineContext() {
  const params = new URLSearchParams(window.location.search);
  const stored = {
    machineName: localStorage.getItem("it_guardian_machine_name") || "",
    assetTag: localStorage.getItem("it_guardian_asset_tag") || "",
    environmentName: localStorage.getItem("it_guardian_environment_name") || ""
  };

  return {
    deviceToken: params.get("device") || "",
    machineName: params.get("machine") || params.get("hostname") || stored.machineName,
    assetTag: params.get("patrimonio") || params.get("assetTag") || stored.assetTag,
    environmentName: params.get("ambiente") || params.get("environment") || stored.environmentName
  };
}

function buildRelatedAssetText(form) {
  return [
    form.machineName ? `Nome da máquina: ${form.machineName}` : "",
    form.assetTag ? `Patrimônio: ${form.assetTag}` : "",
    form.location ? `Localização: ${form.location}` : ""
  ].filter(Boolean).join(" | ");
}

export default function PublicSupportRequest() {
  const machineContext = useMemo(readMachineContext, []);
  const [systemMode, setSystemMode] = useState("local");
  const businessMode = systemMode === "business";
  const [options, setOptions] = useState({
    categories: fallbackCategories,
    problemTypes: fallbackProblemTypes
  });
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: fallbackCategories[0],
    problemType: fallbackProblemTypes[0].name,
    requesterName: "",
    contactInfo: "",
    department: "",
    extension: "",
    urgency: "normal",
    machineScope: "",
    deviceToken: machineContext.deviceToken,
    assetId: "",
    machineName: machineContext.machineName,
    assetTag: machineContext.assetTag,
    environmentName: machineContext.environmentName || "Não identificado",
    location: "",
    machineNotes: "",
    [honeypotFieldName]: ""
  });
  const [step, setStep] = useState("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [machine, setMachine] = useState(null);
  const [machineContextLoading, setMachineContextLoading] = useState(Boolean(machineContext.deviceToken));
  const [machineContextError, setMachineContextError] = useState(false);

  useEffect(() => {
    let active = true;

    fetchPublicSupportOptions()
      .then((data) => {
        if (!active) return;
        const categories = data.categories?.length ? data.categories : fallbackCategories;
        const problemTypes = data.problemTypes?.length ? data.problemTypes : fallbackProblemTypes;
        const nextSystemMode = data.systemMode === "business" ? "business" : "local";

        setSystemMode(nextSystemMode);
        setOptions({ categories, problemTypes });
        setForm((current) => ({
          ...current,
          category: categories.includes(current.category) ? current.category : categories[0] || "",
          problemType: findProblemType(problemTypes, current.problemType)?.name ||
            getFirstProblemTypeForCategory(
              problemTypes,
              categories.includes(current.category) ? current.category : categories[0]
            )?.name ||
            ""
        }));
      })
      .catch(() => {
        if (active) setOptions({ categories: fallbackCategories, problemTypes: fallbackProblemTypes });
      });

    return () => {
      active = false;
    };
  }, []);

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

  if (success) {
    return <PublicSupportSuccess success={success} onReset={() => window.location.reload()} />;
  }

  return (
    <main className="public-support-page">
      <section className="public-support-card">
        <header className="public-support-header">
          <div className="public-support-brand">
            <ShieldCheck size={34} />
            <div>
              <strong>IT Guardian</strong>
              <span>Monitoramento e suporte</span>
            </div>
          </div>
          <div>
            <h1>Abrir chamado de suporte</h1>
            <p>
              Descreva o problema encontrado. A equipe técnica receberá sua solicitação e acompanhará o
              atendimento pelo IT Guardian. Esta tela não dá acesso ao painel administrativo.
            </p>
          </div>
        </header>

        {step === "form" ? (
          <PublicSupportForm
            form={form}
            options={options}
            businessMode={businessMode}
            deviceToken={machineContext.deviceToken}
            machineContextLoading={machineContextLoading}
            machineContextError={machineContextError}
            machine={machine}
            updateField={updateField}
            updateCategory={updateCategory}
            updateProblemType={updateProblemType}
            error={error}
            onSubmit={goToSummary}
          />
        ) : (
          <PublicSupportSummary
            form={form}
            machine={machine}
            loading={loading}
            error={error}
            onBack={() => setStep("form")}
            onConfirm={confirmSubmit}
          />
        )}
      </section>
    </main>
  );
}
