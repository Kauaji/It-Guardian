import {
  getPublicMachineContext,
  getSupportOptions,
  submitPublicServiceOrder
} from "../services/publicServiceOrderService.js";

export async function supportOptions(_req, res, next) {
  try {
    const options = await getSupportOptions();
    res.json(options);
  } catch (error) {
    next(error);
  }
}

export async function publicMachineContext(req, res, next) {
  try {
    const machine = await getPublicMachineContext(req.query.device);
    res.json({ machine });
  } catch (error) {
    next(error);
  }
}

export async function createPublicServiceOrder(req, res, next) {
  try {
    const serviceOrder = await submitPublicServiceOrder(req.body);
    res.status(201).json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}
