import { Plus } from "lucide-react";

function CategoryField({ field, form, categoryOptions, updateField, onAddCategory }) {
  return (
    <div className="settings-category-input">
      <select
        value={form[field.name] ?? ""}
        onChange={(event) => updateField(field.name, event.target.value)}
      >
        <option value="">Selecione uma categoria</option>
        {categoryOptions.map((category) => (
          <option key={category} value={category}>{category}</option>
        ))}
      </select>
      <button
        type="button"
        className="icon-button"
        onClick={onAddCategory}
        title="Adicionar categoria"
        aria-label="Adicionar categoria"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}

function ClientMultiField({ field, form, clients, updateField }) {
  return (
    <select
      multiple
      size={Math.min(6, Math.max(3, clients.length || 3))}
      value={form[field.name] || []}
      onChange={(event) =>
        updateField(field.name, Array.from(event.target.selectedOptions).map((option) => option.value))
      }
    >
      {clients.length ? clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.tradeName || client.legalName || client.name}
        </option>
      )) : (
        <option value="" disabled>Nenhum cliente cadastrado</option>
      )}
    </select>
  );
}

/** Controle de formulário de um campo do cadastro, conforme `field.type`. */
function FieldControl({ field, form, clients, categoryOptions, updateField, onAddCategory }) {
  if (field.type === "textarea") {
    return (
      <textarea
        value={form[field.name] || ""}
        onChange={(event) => updateField(field.name, event.target.value)}
      />
    );
  }
  if (field.type === "status") {
    return (
      <select
        value={form[field.name] ? "active" : "inactive"}
        onChange={(event) => updateField(field.name, event.target.value === "active")}
      >
        <option value="active">Ativo</option>
        <option value="inactive">Inativo</option>
      </select>
    );
  }
  if (field.type === "select") {
    return (
      <select
        value={form[field.name] ?? ""}
        onChange={(event) => updateField(field.name, event.target.value)}
      >
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }
  if (field.type === "category") {
    return (
      <CategoryField
        field={field}
        form={form}
        categoryOptions={categoryOptions}
        updateField={updateField}
        onAddCategory={onAddCategory}
      />
    );
  }
  if (field.type === "clientMulti") {
    return <ClientMultiField field={field} form={form} clients={clients} updateField={updateField} />;
  }
  if (field.type === "currency") {
    return (
      <input
        type="text"
        inputMode="decimal"
        value={form[field.name] ?? ""}
        onChange={(event) => updateField(field.name, event.target.value)}
        placeholder="R$ 0,00"
      />
    );
  }
  return (
    <input
      type={field.type || "text"}
      value={form[field.name] ?? ""}
      min={field.type === "number" ? 0 : undefined}
      required={field.required}
      onChange={(event) => updateField(field.name, event.target.value)}
    />
  );
}

export default function SettingsFormField({ field, ...controlProps }) {
  return (
    <label className={field.wide ? "settings-wide-field" : ""}>
      {field.label}
      <FieldControl field={field} {...controlProps} />
    </label>
  );
}
