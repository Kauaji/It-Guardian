import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";

export default function CategoryModal({ categories, saving, onClose, onCreate, onDelete }) {
  const [name, setName] = useState("");
  const dialogRef = useModalLifecycle(true, onClose);
  return (
    <div className="parts-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={dialogRef}
        className="parts-form-modal parts-category-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parts-category-title"
      >
        <header>
          <div>
            <span>Configuração do inventário</span>
            <h2 id="parts-category-title">Categorias de peças</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        <form
          className="parts-category-create"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) onCreate(name.trim()).then(() => setName(""));
          }}
        >
          <label>
            Nova categoria
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Refrigeração" />
          </label>
          <button className="primary-action" disabled={saving || !name.trim()}>
            Adicionar
          </button>
        </form>
        <div className="parts-category-list">
          {categories.map((category) => (
            <div key={category.id}>
              <span style={{ "--category-color": category.color }} />
              <strong>{category.name}</strong>
              <button
                type="button"
                className="icon-button danger"
                onClick={() => onDelete(category.id)}
                aria-label={`Remover ${category.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
