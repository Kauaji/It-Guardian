import { riskLabels, scriptTypeLabels } from "./scriptModel.js";

function TextField({ label, field, form, onChange, className, ...inputProps }) {
  return (
    <label className={className}>
      {label}
      <input value={form[field]} onChange={(event) => onChange(field, event.target.value)} {...inputProps} />
    </label>
  );
}

function SelectField({ label, field, form, onChange, labels }) {
  return (
    <label>
      {label}
      <select value={form[field]} onChange={(event) => onChange(field, event.target.value)}>
        {Object.entries(labels).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckField({ label, field, form, onChange }) {
  return (
    <label className="inline-check maintenance-script-checkbox">
      <input type="checkbox" checked={form[field]} onChange={(event) => onChange(field, event.target.checked)} />
      {label}
    </label>
  );
}

/** Campos do formulário de script; o conteúdo usa onChangeContent para invalidar a análise. */
export default function ScriptFormFields({ form, onChange, onChangeContent }) {
  const shared = { form, onChange };
  return (
    <>
      <TextField {...shared} label="Nome" field="name" maxLength={120} required />
      <SelectField {...shared} label="Tipo" field="type" labels={scriptTypeLabels} />
      <TextField {...shared} label="Categoria" field="category" maxLength={80} />
      <SelectField {...shared} label="Risco" field="riskLevel" labels={riskLabels} />
      <label className="maintenance-script-wide">
        Descrição
        <textarea value={form.description} onChange={(event) => onChange("description", event.target.value)} maxLength={500} rows={3} />
      </label>
      <TextField {...shared} label="Tipo de aviso" field="alertType" maxLength={80} />
      <TextField {...shared} label="Tipo de problema" field="problemType" maxLength={120} />
      <TextField {...shared} label="Tags" field="tags" placeholder="rede, disco, impressora" />
      <TextField {...shared} label="Tipos de aviso relacionados" field="relatedAlertTypes" placeholder="disk_usage, ping_failure" />
      <TextField
        {...shared}
        label="Tipos de problema relacionados"
        field="relatedProblemTypes"
        placeholder="Disco acima do limite, Internet lenta"
      />
      <TextField {...shared} label="Categorias recomendadas" field="recommendedForCategories" placeholder="Hardware, Rede, Impressora" />
      <CheckField {...shared} label="Requer usuário logado" field="requiresLoggedUser" />
      <CheckField {...shared} label="Requer administrador" field="requiresAdmin" />
      <CheckField {...shared} label="Exige confirmação" field="requiresConfirmation" />
      <label className="maintenance-script-wide">
        Prompt do script
        <textarea
          value={form.content}
          onChange={(event) => onChangeContent(event.target.value)}
          maxLength={10000}
          rows={9}
          required
          placeholder="Cole aqui o conteúdo ou a descrição do BAT/CMD/PowerShell para o sistema analisar e preencher o cadastro."
        />
      </label>
    </>
  );
}
