import { Search, Upload } from "lucide-react";

export default function SettingsToolbar({ config, search, onSearch, fileInputRef, onImportFile, onCreate }) {
  const label = `Buscar ${config.searchLabel || config.plural}`;
  return (
    <header className="settings-toolbar">
      <div className="search-box settings-search">
        <Search size={18} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={label} aria-label={label} />
      </div>
      <div className="settings-actions">
        {config.importable && (
          <>
            <button type="button" className="secondary-action compact-action" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              Importar
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx" hidden onChange={onImportFile} />
          </>
        )}
        <button type="button" className="primary-action compact-action" onClick={onCreate}>
          Novo {config.singular}
        </button>
      </div>
    </header>
  );
}
