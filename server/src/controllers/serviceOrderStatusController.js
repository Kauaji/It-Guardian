import {
  createStatus,
  listStatuses,
  removeStatus,
  updateStatus
} from "../services/serviceOrderStatusService.js";

export async function list(req, res, next) {
  try {
    const statuses = await listStatuses();
    res.json({ statuses });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const result = await createStatus(req.body, req.user);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const result = await updateStatus(req.params.id, req.body, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const result = await removeStatus(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
