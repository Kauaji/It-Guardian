import { honeypotFieldName, urgencyOptions } from "./publicSupportValidation.js";
import PublicSupportMachineSection from "./support/PublicSupportMachineSection.jsx";

function TextField({ label, field, form, updateField, className, ...inputProps }) {
  return (
    <label className={className}>
      {label}
      <input {...inputProps} value={form[field]} onChange={(event) => updateField(field, event.target.value)} />
    </label>
  );
}

function IdentificationFields({ form, businessMode, updateField }) {
  const shared = { form, updateField };
  return (
    <>
      <TextField {...shared} label="Solicitante" field="requesterName" required placeholder="Seu nome" />

      {businessMode && (
        <TextField {...shared} label="WhatsApp" field="contactInfo" required placeholder="Número do WhatsApp" />
      )}

      {!businessMode && (
        <TextField {...shared} label="Ramal" field="extension" placeholder="Ramal para contato" />
      )}

      <TextField {...shared} label="Setor" field="department" placeholder="Financeiro, RH, recepção..." />

      <label>
        Urgência percebida
        <select value={form.urgency} onChange={(event) => updateField("urgency", event.target.value)}>
          {urgencyOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      {businessMode && (
        <TextField {...shared} label="Cliente" field="environmentName" required placeholder="Cliente, filial ou ambiente" />
      )}
    </>
  );
}

function ProblemFields({ form, options, updateField, updateCategory, updateProblemType }) {
  return (
    <>
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
    </>
  );
}

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

      <ProblemFields
        form={form}
        options={options}
        updateField={updateField}
        updateCategory={updateCategory}
        updateProblemType={updateProblemType}
      />
      <IdentificationFields form={form} businessMode={businessMode} updateField={updateField} />

      <PublicSupportMachineSection
        form={form}
        deviceToken={deviceToken}
        machineContextLoading={machineContextLoading}
        machineContextError={machineContextError}
        machine={machine}
        updateField={updateField}
      />

      {error && <div className="public-support-error public-support-wide">{error}</div>}

      <div className="public-support-actions public-support-wide">
        <button className="primary-action" type="submit">
          Revisar e enviar
        </button>
      </div>
    </form>
  );
}
