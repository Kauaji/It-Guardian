import { normalizePrioritySettings } from "./alertUtils.js";

// Valores padrao estaveis (fora dos componentes) para nao invalidar memos e
// efeitos a cada render quando o contexto nao informa o dado.
export const emptyList = [];
export const defaultAutomationManagement = {
  plans: [],
  machines: [],
  metadata: { planCount: 0, machineCount: 0 }
};
export const defaultPrioritySettings = normalizePrioritySettings();
