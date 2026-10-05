import { formatServiceOrderNumber } from "../../domain/serviceOrders/serviceOrderSettings.js";
import { getServiceOrderSettings, updateServiceOrderSettings } from "../../repositories/serviceOrders/serviceOrderSettingsRepository.js";
import { countServiceOrders, serviceOrderNumberExists } from "../../repositories/serviceOrders/serviceOrderWriteRepository.js";

// Fila em memoria: serializa a geracao de numeros dentro do processo.
let serviceOrderNumberQueue = Promise.resolve();

async function withServiceOrderNumberLock(operation) {
  const previous = serviceOrderNumberQueue;
  let release = () => {};
  serviceOrderNumberQueue = new Promise((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await operation();
  } finally {
    release();
  }
}

export async function nextServiceOrderNumber() {
  return withServiceOrderNumberLock(async () => {
    const settings = await getServiceOrderSettings();
    const fallbackNext = (await countServiceOrders()) + 1;
    let sequence = settings.numberFormat.nextNumber || fallbackNext;
    let number = formatServiceOrderNumber(sequence, settings);

    while (await serviceOrderNumberExists(number)) {
      sequence += 1;
      number = formatServiceOrderNumber(sequence, settings);
    }

    await updateServiceOrderSettings({
      ...settings,
      numberFormat: {
        ...settings.numberFormat,
        nextNumber: sequence + 1
      }
    });

    return number;
  });
}
