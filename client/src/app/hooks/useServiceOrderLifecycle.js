import { deleteServiceOrder, updateServiceOrderStatus } from "../../api.js";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { isMaintenanceSegmentName } from "../../utils/display.js";

function isInMaintenance(asset) {
  return Boolean(asset) && (asset.maintenance || isMaintenanceSegmentName(asset.segmentName));
}

// Mudanca de status e exclusao de OS, incluindo os efeitos colaterais no
// inventario: devolver o Backup e retirar a maquina da manutencao ao fechar.
export function useServiceOrderLifecycle({ backupFlow, data, inventory, maintenanceExit, serviceOrderCore }) {
  const { token, notify } = useAppSession();
  const { findDecoratedDevice } = inventory.model;
  const { setServiceOrders } = data;
  const { setServiceOrderSaving } = serviceOrderCore;

  async function handleDeleteServiceOrder(order) {
    if (!order) return false;

    if (order.backupAssetId) {
      notify("Esta OS possui uma máquina Backup em uso. Devolva o Backup ou finalize a OS antes de excluir.", "danger");
      return false;
    }

    const linkedMachine = findDecoratedDevice(order.assetId);
    if (isInMaintenance(linkedMachine)) {
      notify("Esta OS possui uma máquina em manutenção. Finalize a OS ou retire a máquina da manutenção antes de excluir.", "danger");
      return false;
    }

    setServiceOrderSaving(true);
    try {
      await deleteServiceOrder(token, order.id);
      setServiceOrders((current) => current.filter((item) => item.id !== order.id));
      notify(`Ordem ${order.number} excluída.`, "ok");
      return true;
    } catch (error) {
      notify(error.message, "danger");
      return false;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  async function handleChangeServiceOrderStatus(order, statusValue) {
    if (!order || order.status === statusValue) return order;

    setServiceOrderSaving(true);
    try {
      const response = await updateServiceOrderStatus(token, order.id, statusValue);
      setServiceOrders((current) =>
        current.map((item) => (item.id === order.id ? response.serviceOrder : item))
      );
      notify("Status da OS atualizado.", "ok");

      if (response.serviceOrder.closedAt && response.serviceOrder.backupAssetId) {
        await backupFlow.releaseBackupForServiceOrder(response.serviceOrder, { finalized: true });
      }

      if (response.serviceOrder.closedAt && response.serviceOrder.assetId) {
        const asset = findDecoratedDevice(response.serviceOrder.assetId);

        if (isInMaintenance(asset)) {
          const removedFromMaintenance = await maintenanceExit.removeMachineFromMaintenance(asset, {
            serviceOrder: response.serviceOrder
          });
          if (removedFromMaintenance) {
            await serviceOrderCore.addServiceOrderSystemHistory(response.serviceOrder.id, {
              eventType: "maintenance",
              message: "OS finalizada e máquina retirada da manutenção.",
              oldValue: asset.segmentName || "Manutenção"
            });
          }
        }
      }

      return response.serviceOrder;
    } catch (error) {
      notify(error.message, "danger");
      return null;
    } finally {
      setServiceOrderSaving(false);
    }
  }

  return { handleChangeServiceOrderStatus, handleDeleteServiceOrder };
}
