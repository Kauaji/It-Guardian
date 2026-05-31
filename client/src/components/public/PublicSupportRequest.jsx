import { useEffect, useMemo, useState } from "react";
import { CheckCircle, HelpCircle, Monitor, Send, ShieldCheck } from "lucide-react";
import {
  createPublicServiceOrder,
  fetchPublicSupportOptions
} from "../../api.js";

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
  { id: "computer-power", name: "Computador nao liga", category: "Computador", defaultPriority: "high" },
  { id: "printer", name: "Impressora nao imprime", category: "Impressora", defaultPriority: "medium" },
  { id: "network", name: "Internet lenta", category: "Rede", defaultPriority: "medium" },
  { id: "system", name: "Sistema travando", category: "Sistema", defaultPriority: "medium" },
  { id: "monitor", name: "Monitor sem imagem", category: "Monitor", defaultPriority: "medium" },
  { id: "keyboard", name: "Teclado com defeito", category: "Teclado", defaultPriority: "low" },
  { id: "mouse", name: "Mouse com defeito", category: "Mouse", defaultPriority: "low" }
];

const priorityLabels = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  critical: "Critica"
};

function findProblemType(problemTypes, value) {
  return problemTypes.find(
    (problemType) => problemType.name === value || problemType.id === value
  );
}

function getFirstProblemTypeForCategory(problemTypes, category) {
  return problemTypes.find((problemType) => !problemType.category || problemType.category === category) ||
    problemTypes[0];
}

function readSystemMode() {
  return "local";
}

function readMachineContext() {
  const params = new URLSearchParams(window.location.search);
  const stored = {
    assetId: localStorage.getItem("it_guardian_asset_id") || "",
    machineName: localStorage.getItem("it_guardian_machine_name") || "",
    assetTag: localStorage.getItem("it_guardian_asset_tag") || "",
    environmentName: localStorage.getItem("it_guardian_environment_name") || ""
  };

  return {
    assetId: params.get("assetId") || params.get("asset") || stored.assetId,
    machineName: params.get("machine") || params.get("hostname") || stored.machineName,
    assetTag: params.get("patrimonio") || params.get("assetTag") || stored.assetTag,
    environmentName: params.get("ambiente") || params.get("environment") || stored.environmentName
  };
}

function buildRelatedAssetText(form) {
  return [
    form.machineName ? `Nome: ${form.machineName}` : "",
    form.assetTag ? `Patrimonio: ${form.assetTag}` : "",
    form.location ? `Local: ${form.location}` : ""
  ].filter(Boolean).join(" | ");
}

export default function PublicSupportRequest() {
  const machineContext = useMemo(readMachineContext, []);
  const [systemMode, setSystemMode] = useState(readSystemMode);
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
    machineScope: "mine",
    assetId: machineContext.assetId,
    machineName: machineContext.machineName,
    assetTag: machineContext.assetTag,
    environmentName: machineContext.environmentName || "Nao identificado",
    location: "",
    machineNotes: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

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

  const selectedProblemType = options.problemTypes.find(
    (problemType) => problemType.name === form.problemType || problemType.id === form.problemType
  );
  const calculatedPriority = selectedProblemType?.defaultPriority || "medium";
  const visibleProblemTypes = options.problemTypes;

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

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (
      businessMode &&
      (!form.environmentName.trim() || form.environmentName.trim().toLowerCase() === "nao identificado")
    ) {
      setError("No modo Business, selecione um cliente para abrir a Ordem de Servico.");
      return;
    }

    setLoading(true);

    try {
      const response = await createPublicServiceOrder({
        ...form,
        contactInfo: businessMode ? form.contactInfo : "",
        extension: businessMode ? form.extension : "",
        relatedAssetText: buildRelatedAssetText(form)
      });
      setSuccess(response.serviceOrder);
    } catch (submitError) {
      setError(submitError.message || "Nao foi possivel enviar a solicitacao.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="public-support-page">
        <section className="public-support-card public-support-success">
          <div className="public-support-brand">
            <ShieldCheck size={34} />
            <div>
              <strong>IT Guardian</strong>
              <span>Suporte tecnico</span>
            </div>
          </div>
          <CheckCircle size={54} />
          <h1>Solicitacao enviada com sucesso.</h1>
          <p>A equipe tecnica recebeu o chamado e ira analisar as informacoes enviadas.</p>
          <div className="public-support-ticket">
            <span>Numero da OS</span>
            <strong>{success.number}</strong>
          </div>
          <div className="public-support-meta">
            <span>Prioridade inicial: {priorityLabels[success.priority] || "Media"}</span>
            <span>{new Date(success.createdAt).toLocaleString("pt-BR")}</span>
          </div>
          <button className="primary-action" onClick={() => window.location.reload()}>
            Abrir outra solicitacao
          </button>
        </section>
      </main>
    );
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
              {businessMode
                ? "Envie sua solicitacao com cliente/ambiente identificado. Esta tela nao da acesso ao painel administrativo."
                : "Envie sua solicitacao para a equipe tecnica. Esta tela nao da acesso ao painel administrativo."}
            </p>
          </div>
        </header>

        <form className="public-support-form" onSubmit={submit}>
          <label className="public-support-wide">
            Titulo
            <input
              required
              minLength={3}
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Ex: Computador nao inicia"
            />
          </label>

          <label>
            Categoria
            <select
              required
              value={form.category}
              onChange={(event) => updateCategory(event.target.value)}
            >
              {options.categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label>
            Tipo de problema
            <select
              required
              value={form.problemType}
              onChange={(event) => updateProblemType(event.target.value)}
            >
              {visibleProblemTypes.map((problemType) => (
                <option key={problemType.id || problemType.name} value={problemType.name}>
                  {problemType.name}
                </option>
              ))}
            </select>
          </label>

          <label className="public-support-wide">
            Observacoes / descricao do problema
            <textarea
              required
              minLength={5}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Descreva o que aconteceu, quando comecou e qualquer mensagem de erro exibida."
            />
          </label>

          <label>
            Solicitante
            <input
              required
              value={form.requesterName}
              onChange={(event) => updateField("requesterName", event.target.value)}
              placeholder="Seu nome"
            />
          </label>

          {businessMode && (
            <label>
              Contato
              <input
                required
                value={form.contactInfo}
                onChange={(event) => updateField("contactInfo", event.target.value)}
                placeholder="Telefone, e-mail ou chat"
              />
            </label>
          )}

          <label>
            Setor
            <input
              value={form.department}
              onChange={(event) => updateField("department", event.target.value)}
              placeholder="Financeiro, RH, recepcao..."
            />
          </label>

          {businessMode && (
            <label>
              Ramal
              <input
                required
                value={form.extension}
                onChange={(event) => updateField("extension", event.target.value)}
                placeholder="Ramal ou identificador do contato"
              />
            </label>
          )}

          <section className="public-support-machine public-support-wide">
            <div className="public-support-section-title">
              <Monitor size={18} />
              <div>
                <strong>Maquina relacionada</strong>
                <span>O navegador nao consegue identificar tudo sozinho. Um atalho/agente podera preencher isso no futuro.</span>
              </div>
            </div>
            <div className="public-support-choices">
              <label className={form.machineScope === "mine" ? "selected" : ""}>
                <input
                  type="radio"
                  name="machineScope"
                  checked={form.machineScope === "mine"}
                  onChange={() => updateField("machineScope", "mine")}
                />
                O problema e na minha maquina
              </label>
              <label className={form.machineScope === "other" ? "selected" : ""}>
                <input
                  type="radio"
                  name="machineScope"
                  checked={form.machineScope === "other"}
                  onChange={() => updateField("machineScope", "other")}
                />
                O problema e em outra maquina/equipamento
              </label>
            </div>

            <div className="public-support-machine-grid">
              <label>
                Nome da maquina/equipamento
                <input
                  value={form.machineName}
                  onChange={(event) => updateField("machineName", event.target.value)}
                  placeholder="Hostname, nome ou descricao"
                />
              </label>
              <label>
                Patrimonio
                <input
                  value={form.assetTag}
                  onChange={(event) => updateField("assetTag", event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label>
                {businessMode ? "Cliente/Ambiente" : "Ambiente"}
                <input
                  value={form.environmentName}
                  onChange={(event) => updateField("environmentName", event.target.value)}
                  placeholder={businessMode ? "Cliente, filial ou ambiente" : "Nao identificado"}
                />
              </label>
              <label>
                Localizacao
                <input
                  value={form.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  placeholder="Sala, setor, mesa..."
                />
              </label>
            </div>
          </section>

          <div className="public-support-priority public-support-wide">
            <HelpCircle size={18} />
            <span>Prioridade calculada pelo sistema:</span>
            <strong>{priorityLabels[calculatedPriority] || "Media"}</strong>
          </div>

          {error && <div className="public-support-error public-support-wide">{error}</div>}

          <div className="public-support-actions public-support-wide">
            <button className="primary-action" disabled={loading}>
              <Send size={18} />
              {loading ? "Enviando..." : "Enviar solicitacao"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
