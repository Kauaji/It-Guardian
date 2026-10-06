import { useState } from "react";
import { addServiceOrderHistory, createServiceOrder, reopenServiceOrder, updateServiceOrder } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { getServiceOrderModeError } from "../inventory/serviceOrderRules.js";

// CRUD basico de Ordens de Servico (criar, atualizar, reabrir e registrar
// historico) com o estado de "salvando" que o quadro de OS exibe.
export function useServiceOrderCore({ data }) {
  const { token, notify } = useAppSession();
  const { loadData, setServiceOrders, systemMode } = data;
  const [serviceOrderSaving, setServiceOrderSaving] = useState(false);

  function addServiceOrderHistoryToState(orderId, event) {
    if (!event) return;

    setServiceOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, history: [event, ...(order.history || [])] } : order))
    );
  }

  async function addServiceOrderSystemHistory(orderId, payload) {
    try {
      const response = await addServiceOrderHistory(token, orderId, payload);
      addServiceOrderHistoryToState(orderId, response.event);
      return response.event;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    }
  }

  async function handleCreateServiceOrder(payload) {
    const modeError = getServiceOrderModeError(payload, systemMode);
    if (modeError) {
      notify(modeError, "danger");
      return null;
    }

    setServiceOrderSaving(true);
    try {
      const response = await createServiceOrder(token, payload);
      setServiceOrders((current) => [response.serviceOrder, ...current]);
      notify(`Ordem ${response.serviceOrder.number} criada.`, "ok");
      await loadData(true);
      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  async function handleUpdateServiceOrder(id, payload) {
    setServiceOrderSaving(true);
    try {
      const response = await updateServiceOrder(token, id, payload);
      setServiceOrders((current) => current.map((order) => (order.id === id ? response.serviceOrder : order)));
      notify("Ordem de Serviço atualizada.", "ok");
      await loadData(true);
      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  async function handleReopenServiceOrder(id, reason) {
    setServiceOrderSaving(true);
    try {
      const response = await reopenServiceOrder(token, id, reason);
      setServiceOrders((current) => current.map((order) => (order.id === id ? response.serviceOrder : order)));
      notify("Ordem de Serviço reaberta.", "ok");
      await loadData(true);
      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  async function handleAddServiceOrderHistory(id, payload) {
    try {
      const response = await addServiceOrderHistory(token, id, payload);
      setServiceOrders((current) =>
        current.map((order) => (order.id === id ? { ...order, history: [response.event, ...(order.history || [])] } : order))
      );
      notify("Registro adicionado ao histórico.", "ok");
      return response.event;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    }
  }

  return {
    addServiceOrderSystemHistory,
    handleAddServiceOrderHistory,
    handleCreateServiceOrder,
    handleReopenServiceOrder,
    handleUpdateServiceOrder,
    serviceOrderSaving,
    setServiceOrderSaving
  };
}
