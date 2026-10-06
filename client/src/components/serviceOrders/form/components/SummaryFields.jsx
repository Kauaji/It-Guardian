import { assetTypeOptions } from "../../../inventory/assetTypes.js";
import { GENERAL_SECTOR_ID, priorities } from "../utils/formModel.js";

// Titulo, descricao, prioridade, categoria e setor da nova OS.
export default function SummaryFields({ form, availableSectors, updateField }) {
  return (
    <>
      <label className="service-order-wide">
        Título/resumo
        <input
          autoFocus
          value={form.title}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="Ex: Computador do financeiro não inicia"
        />
      </label>

      <label className="service-order-wide">
        Descrição do problema
        <textarea
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
          placeholder="Descreva o problema informado pelo usuário ou técnico."
        />
      </label>

      <label>
        Prioridade
        <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
          {priorities.map((priority) => (
            <option key={priority.value} value={priority.value}>{priority.label}</option>
          ))}
        </select>
      </label>

      <label>
        Categoria
        <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
          <option value="">Selecione</option>
          {assetTypeOptions.map((option) => (
            <option key={option.value} value={option.label}>{option.label}</option>
          ))}
        </select>
      </label>

      <label>
        Setor
        <select value={form.sectorId} onChange={(event) => updateField("sectorId", event.target.value || GENERAL_SECTOR_ID)}>
          {availableSectors.map((sector) => (
            <option key={sector.id} value={sector.id}>{sector.name}</option>
          ))}
        </select>
      </label>
    </>
  );
}
