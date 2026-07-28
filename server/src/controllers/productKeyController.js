import {
  activateCollector,
  configureProductKeyMonitoring,
  createManagedProductKey,
  deactivateDeviceActivation,
  listDeviceActivations,
  listProductKeys,
  setProductKeyActive
} from "../services/productKeyService.js";

export async function activate(req, res, next) {
  try {
    res.status(201).json(await activateCollector(req.body));
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const result = await createManagedProductKey(req.body, req.user.id);
    res.status(201).json({
      productKey: result.productKey,
      key: result.key,
      warning: "A chave completa e exibida apenas uma vez. Armazene-a com seguranca."
    });
  } catch (error) {
    next(error);
  }
}

export async function list(_req, res, next) {
  try {
    res.json({ productKeys: await listProductKeys() });
  } catch (error) {
    next(error);
  }
}

export async function activations(req, res, next) {
  try {
    res.json({ activations: await listDeviceActivations(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function deactivateActivation(req, res, next) {
  try {
    const activation = await deactivateDeviceActivation(req.params.id);
    if (!activation) return res.status(404).json({ message: "Ativacao nao encontrada." });
    return res.json({ activation });
  } catch (error) {
    return next(error);
  }
}

export async function changeStatus(req, res, next) {
  try {
    if (typeof req.body?.active !== "boolean") {
      return res.status(400).json({ message: "Informe o estado ativo da chave." });
    }
    const productKey = await setProductKeyActive(req.params.id, req.body.active);
    if (!productKey) return res.status(404).json({ message: "Chave de produto nao encontrada." });
    return res.json({ productKey });
  } catch (error) {
    return next(error);
  }
}

export async function configureMonitoring(req, res, next) {
  try {
    const productKey = await configureProductKeyMonitoring(req.params.id, req.body);
    if (!productKey) return res.status(404).json({ message: "Chave de produto nao encontrada." });
    return res.json({ productKey });
  } catch (error) {
    return next(error);
  }
}
