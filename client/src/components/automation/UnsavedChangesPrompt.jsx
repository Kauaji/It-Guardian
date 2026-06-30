export default function UnsavedChangesPrompt({
  open,
  onContinueEditing,
  onDiscard
}) {
  if (!open) return null;

  return (
    <div className="automation-unsaved-layer" role="alertdialog" aria-modal="true" aria-labelledby="automation-unsaved-title">
      <section>
        <h3 id="automation-unsaved-title">Existem alterações não salvas. Deseja descartá-las?</h3>
        <div>
          <button type="button" className="secondary-action compact-action" onClick={onContinueEditing}>
            Continuar editando
          </button>
          <button type="button" className="danger-action compact-action" onClick={onDiscard}>
            Descartar alterações
          </button>
        </div>
      </section>
    </div>
  );
}
