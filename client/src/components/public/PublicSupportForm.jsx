import { Monitor } from "lucide-react";
import { honeypotFieldName, urgencyOptions } from "./publicSupportValidation.js";
import PublicSupportMachineSummary from "./PublicSupportMachineSummary.jsx";

export default function PublicSupportForm({
  form,
  options,
  businessMode,
  deviceToken,
  machineContextLoading,
  machineContextError,
  machine,
  updateField,
  updateCategory,
  updateProblemType,
  error,
  onSubmit
}) {
  return (
    <form className="public-support-form" onSubmit={onSubmit}>
      {/* Honeypot: escondido por CSS (nao display:none, alguns bots ignoram),
          nunca visivel ou navegavel por teclado para uma pessoa real. */}
      <label className="public-support-honeypot" aria-hidden="true">
        Deixe este campo em branco
        <input
          type="text"
          name={honeypotFieldName}
          tabIndex={-1}
          autoComplete="off"
          value={form[honeypotFieldName] || ""}
          onChange={(event) => updateField(honeypotFieldName, event.target.value)}
        />
      </label>

      <label className="public-support-wide">
        Título
        <input
          required
          minLength={3}
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="Ex: Computador não inicia"
        />
      </label>

      <label>
        Categoria
        <select required value={form.category} onChange={(event) => updateCategory(event.target.value)}>
          {options.categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>

      <label>
        Tipo de problema
        <select required value={form.problemType} onChange={(event) => updateProblemType(event.target.value)}>
          {options.problemTypes.map((problemType) => (
            <option key={problemType.id || problemType.name} value={problemType.name}>
              {problemType.name}
            </option>
          ))}
        </select>
      </label>

      <label className="public-support-wide">
        Descrição do problema
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
          WhatsApp
          <input
            required
            value={form.contactInfo}
            onChange={(event) => updateField("contactInfo", event.target.value)}
            placeholder="Número do WhatsApp"
          />
        </label>
      )}

      {!businessMode && (
        <label>
          Ramal
          <input
            value={form.extension}
            onChange={(event) => updateField("extension", event.target.value)}
            placeholder="Ramal para contato"
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

      <label>
        Urgência percebida
        <select value={form.urgency} onChange={(event) => updateField("urgency", event.target.value)}>
          {urgencyOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      {businessMode && (
        <label>
          Cliente
          <input
            required
            value={form.environmentName}
            onChange={(event) => updateField("environmentName", event.target.value)}
            placeholder="Cliente, filial ou ambiente"
          />
        </label>
      )}

      <section className="public-support-machine public-support-wide">
        <div className="public-support-section-title">
          <Monitor size={18} />
          <div>
            <strong>Máquina relacionada</strong>
          </div>
        </div>

        <PublicSupportMachineSummary
          deviceToken={deviceToken}
          machineContextLoading={machineContextLoading}
          machineContextError={machineContextError}
          machine={machine}
        />

        <div className="public-support-choices">
          <label className={form.machineScope === "mine" ? "selected" : ""}>
            <input
              type="radio"
              name="machineScope"
              checked={form.machineScope === "mine"}
              onChange={() => updateField("machineScope", "mine")}
            />
            O problema é na minha máquina
            {form.machineScope === "mine" && form.assetId ? (
              <small>Identificada: {form.machineName}</small>
            ) : null}
          </label>
          <label className={form.machineScope === "other" ? "selected" : ""}>
            <input
              type="radio"
              name="machineScope"
              checked={form.machineScope === "other"}
              onChange={() => updateField("machineScope", "other")}
            />
            O problema é em outra máquina/equipamento
          </label>
        </div>

        {form.machineScope && (
          <div className="public-support-machine-grid">
            <label>
              Nome da máquina
              <input
                value={form.machineName}
                onChange={(event) => updateField("machineName", event.target.value)}
                placeholder="Ex: PC-RECEPCAO-01"
              />
            </label>
            <label>
              Patrimônio
              <input
                value={form.assetTag}
                onChange={(event) => updateField("assetTag", event.target.value)}
                placeholder="Número de patrimônio, se souber"
              />
            </label>
            <label>
              Localização
              <input
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="Setor, sala ou andar"
              />
            </label>
          </div>
        )}
      </section>

      {error && <div className="public-support-error public-support-wide">{error}</div>}

      <div className="public-support-actions public-support-wide">
        <button className="primary-action" type="submit">
          Revisar e enviar
        </button>
      </div>
    </form>
  );
}
