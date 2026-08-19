import {
  addServiceOrderHistoryEntry,
  assignServiceOrderTechnician,
  changeServiceOrderPriority,
  changeServiceOrderStatus,
  createNewServiceOrder,
  createServiceOrderAttachmentEntry,
  deleteServiceOrderAttachmentEntry,
  getServiceOrderDetails,
  getServiceOrderFeedbackEntry,
  getSettings,
  linkServiceOrderAsset,
  listAllServiceOrders,
  listServiceOrderAttachmentsEntry,
  removeServiceOrder,
  reopenServiceOrderEntry,
  replaceServiceOrderItems,
  submitServiceOrderFeedbackEntry,
  updateExistingServiceOrder,
  updateSettingsRecord
} from "../services/serviceOrderService.js";

export async function list(req, res, next) {
  try {
    const serviceOrders = await listAllServiceOrders(req.user);
    res.json({ serviceOrders });
  } catch (error) {
    next(error);
  }
}

export async function details(req, res, next) {
  try {
    const serviceOrder = await getServiceOrderDetails(req.params.id, req.user);
    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function settings(req, res, next) {
  try {
    res.json({ settings: await getSettings() });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const settings = await updateSettingsRecord(req.body, req.user);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const serviceOrder = await createNewServiceOrder(req.body, req.user);
    res.status(201).json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const serviceOrder = await updateExistingServiceOrder(req.params.id, req.body, req.user);
    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function changePriority(req, res, next) {
  try {
    const serviceOrder = await changeServiceOrderPriority(req.params.id, req.body?.priority, req.user);
    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function assignTechnician(req, res, next) {
  try {
    const serviceOrder = await assignServiceOrderTechnician(req.params.id, req.body, req.user);
    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function linkAsset(req, res, next) {
  try {
    const serviceOrder = await linkServiceOrderAsset(req.params.id, req.body, req.user);
    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function replaceItems(req, res, next) {
  try {
    const serviceOrder = await replaceServiceOrderItems(req.params.id, req.body, req.user);
    res.status(201).json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function changeStatus(req, res, next) {
  try {
    const serviceOrder = await changeServiceOrderStatus(req.params.id, req.body.status, req.user);
    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function addHistory(req, res, next) {
  try {
    const event = await addServiceOrderHistoryEntry(req.params.id, req.body, req.user);
    res.status(201).json({ event });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const serviceOrder = await removeServiceOrder(req.params.id, req.user);
    res.json({ deleted: true, serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function reopen(req, res, next) {
  try {
    const serviceOrder = await reopenServiceOrderEntry(req.params.id, req.body, req.user);
    res.json({ serviceOrder });
  } catch (error) {
    next(error);
  }
}

export async function getFeedback(req, res, next) {
  try {
    const feedback = await getServiceOrderFeedbackEntry(req.params.id, req.user);
    res.json({ feedback });
  } catch (error) {
    next(error);
  }
}

export async function submitFeedback(req, res, next) {
  try {
    const feedback = await submitServiceOrderFeedbackEntry(req.params.id, req.body, req.user);
    res.status(201).json({ feedback });
  } catch (error) {
    next(error);
  }
}

export async function listAttachments(req, res, next) {
  try {
    const attachments = await listServiceOrderAttachmentsEntry(req.params.id, req.user);
    res.json({ attachments });
  } catch (error) {
    next(error);
  }
}

export async function addAttachment(req, res, next) {
  try {
    const attachment = await createServiceOrderAttachmentEntry(req.params.id, req.body, req.user);
    res.status(201).json({ attachment });
  } catch (error) {
    next(error);
  }
}

export async function removeAttachment(req, res, next) {
  try {
    const attachment = await deleteServiceOrderAttachmentEntry(req.params.id, req.params.attachmentId, req.user);
    res.json({ deleted: true, attachment });
  } catch (error) {
    next(error);
  }
}
