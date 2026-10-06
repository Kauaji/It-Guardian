import { Boxes, FileUp, PackagePlus } from "lucide-react";

export default function PartsHeader({ permissions, saving, fileInput, onImportFile, onNewPart }) {
  return (
    <header className="parts-page-heading">
      <div>
        <span>
          <Boxes size={16} /> Controle patrimonial e de manutenção
        </span>
        <h2>Inventário de Peças</h2>
        <p>Componentes físicos organizados por família, disponibilidade e computador.</p>
      </div>
      <div className="parts-heading-actions">
        {permissions.importInvoice ? (
          <>
            <input
              ref={fileInput}
              className="parts-file-input"
              hidden
              type="file"
              accept=".xml,application/xml,text/xml"
              onChange={(event) => onImportFile(event.target.files?.[0])}
            />
            <button
              type="button"
              className="secondary-action parts-import-action"
              onClick={() => fileInput.current?.click()}
              disabled={saving}
            >
              <FileUp size={17} /> Importar NF-e
            </button>
          </>
        ) : null}
        {permissions.create ? (
          <button type="button" className="primary-action" onClick={onNewPart}>
            <PackagePlus size={17} /> Cadastrar peça
          </button>
        ) : null}
      </div>
    </header>
  );
}
