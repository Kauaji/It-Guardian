import { randomUUID } from "node:crypto";
import { query } from "../../database.js";
import { normalizeServiceOrderItems } from "../../domain/serviceOrders/serviceOrderItems.js";
import {
  calculateServiceOrderTotals,
  resolveAssignedTechnicianNames,
  resolveCreateServiceValue
} from "../../domain/serviceOrders/serviceOrderPayload.js";
import { buildNewServiceOrderRow } from "../../domain/serviceOrders/serviceOrderRows.js";
import { getInitialStatus } from "../../domain/serviceOrders/serviceOrderSettings.js";
import { computeServiceOrderSlaDueAt } from "../../domain/serviceOrders/serviceOrderSla.js";
import { replaceServiceOrderItems } from "../../repositories/serviceOrders/serviceOrderItemRepository.js";
import { addServiceOrderAssetHistory, addServiceOrderHistory } from "../../repositories/serviceOrders/serviceOrderHistoryRepository.js";
import { fromOrderRow } from "../../repositories/serviceOrders/serviceOrderMappers.js";
import { getServiceOrderSettings } from "../../repositories/serviceOrders/serviceOrderSettingsRepository.js";
import { insertServiceOrderRow, setAssignedTechnicianNames } from "../../repositories/serviceOrders/serviceOrderWriteRepository.js";
import { nextServiceOrderNumber } from "./serviceOrderNumberService.js";
import { calculateConfiguredPriority, resolveServiceOrderSector, resolveServiceOrderService } from "./serviceOrderResolutionService.js";

const maxNumberAttempts = 5;

function isDuplicateServiceOrderNumberError(error) {
  return (
    error?.code === "23505" &&
    /service_orders.*number|idx_service_orders_number_unique|number/i.test(
      `${error.constraint || ""} ${error.detail || ""} ${error.message || ""}`
    )
  );
}

// Insere a OS gerando um numero novo a cada tentativa: duas criacoes
// concorrentes (ou em outro processo) podem disputar o mesmo numero, e o
// indice unico faz a perdedora tentar de novo com o proximo.
async function insertWithNewNumber({ db, buildRow, assignedTechnicianNames }) {
  for (let attempt = 0; attempt < maxNumberAttempts; attempt += 1) {
    const id = randomUUID();
    const number = await nextServiceOrderNumber();

    try {
      const inserted = await insertServiceOrderRow(db, buildRow(id, number));
      const withAssigned = await setAssignedTechnicianNames(id, assignedTechnicianNames, db);
      return { id, row: withAssigned || inserted };
    } catch (error) {
      if (attempt < maxNumberAttempts - 1 && isDuplicateServiceOrderNumberError(error)) continue;
      throw error;
    }
  }
  return null;
}

export async function createServiceOrder({ payload, user, db = query }) {
  const settings = await getServiceOrderSettings();
  const initialStatus = getInitialStatus(settings).id;
  const items = normalizeServiceOrderItems(payload.items || payload.serviceItems || []);
  const sector = await resolveServiceOrderSector(payload);
  const service = await resolveServiceOrderService(payload);
  const money = calculateServiceOrderTotals(resolveCreateServiceValue(payload, service), items);
  const priority = await calculateConfiguredPriority(payload, sector, service);
  const slaDueAt = computeServiceOrderSlaDueAt(priority, settings, new Date());
  const assignedTechnicianNames = resolveAssignedTechnicianNames(payload);

  const created = await insertWithNewNumber({
    db,
    assignedTechnicianNames,
    buildRow: (id, number) =>
      buildNewServiceOrderRow({
        payload,
        id,
        number,
        settings,
        initialStatus,
        priority,
        sector,
        service,
        money,
        assignedTechnicianNames,
        user,
        slaDueAt
      })
  });

  if (!created?.row) {
    const error = new Error("Não foi possível criar a Ordem de Serviço.");
    error.statusCode = 500;
    throw error;
  }
  const { id, row: insertedRow } = created;

  if (items.length) {
    await replaceServiceOrderItems(id, items, db);
  }

  const createdHistory = await addServiceOrderHistory({
    serviceOrderId: id,
    eventType: "created",
    message: `OS criada no setor ${sector.sectorName}.`,
    newValue: payload.title,
    user,
    db
  });
  await addServiceOrderAssetHistory({
    assetId: insertedRow.asset_id,
    serviceOrder: insertedRow,
    eventType: "created",
    message: `criada no setor ${sector.sectorName}.`,
    newValue: payload.title,
    user,
    db
  });

  return fromOrderRow(insertedRow, [createdHistory], items, settings);
}
