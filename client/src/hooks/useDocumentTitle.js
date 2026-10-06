import { useEffect } from "react";

export const APP_TITLE = "IT Guardian";

// Atualiza document.title para a tela atual ("Avisos · IT Guardian"): leitores de tela anunciam o
// titulo a cada mudanca de rota e ele identifica a aba do navegador.
export function useDocumentTitle(screenTitle) {
  useEffect(() => {
    document.title = screenTitle ? `${screenTitle} · ${APP_TITLE}` : APP_TITLE;
  }, [screenTitle]);
}
