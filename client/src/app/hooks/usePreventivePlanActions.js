import { createPreventivePlan, createPreventivePlanServiceOrder } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useWorkspaceData } from "../context/workspaceContexts.js";

// Planos preventivos avulsos (nao automatizados).
export function usePreventivePlanActions() {
  const { token, notify } = useAppSession();
  const { loadData, setPreventivePlans, setServiceOrders } = useWorkspaceData();

  async function handleCreatePreventivePlan(payload) {
    try {
      const response = await createPreventivePlan(token, payload);
      setPreventivePlans((current) => [
        response.preventivePlan,
        ...current.filter((plan) => plan.id !== response.preventivePlan.id)
      ]);
      notify(
        payload.automation?.enabled
          ? "Plano preventivo automatizado registrado. A execução ocorrerá pela agenda."
          : "Preventiva registrada e enfileirada no agente da máquina.",
        "ok"
      );
      await loadData(true);
      return response.preventivePlan;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  async function handleCreatePreventivePlanServiceOrder(planId) {
    try {
      const response = await createPreventivePlanServiceOrder(token, planId);
      setPreventivePlans((current) =>
        current.map((plan) => (plan.id === response.preventivePlan.id ? response.preventivePlan : plan))
      );
      setServiceOrders((current) => [
        response.serviceOrder,
        ...current.filter((order) => order.id !== response.serviceOrder.id)
      ]);
      notify(`OS preventiva ${response.serviceOrder.number} criada.`, "ok");
      await loadData(true);
      return response;
    } catch (error) {
      notify(error.message, "danger");
      throw error;
    }
  }

  return { handleCreatePreventivePlan, handleCreatePreventivePlanServiceOrder };
}
