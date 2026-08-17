import {
  createGroup as createGroupService,
  createNewSegment,
  listAllSegmentGroups,
  listAllSegments,
  removeExistingGroup,
  removeExistingSegment,
  renameExistingGroup,
  renameExistingSegment
} from "../services/segmentService.js";

export async function list(req, res, next) {
  try {
    const segments = await listAllSegments();
    res.json({ segments });
  } catch (error) {
    next(error);
  }
}

export async function listGroups(_req, res, next) {
  try {
    const groups = await listAllSegmentGroups();
    res.json({ groups });
  } catch (error) {
    next(error);
  }
}

export async function createGroup(req, res, next) {
  try {
    const group = await createGroupService(req.body, req.user);
    res.status(201).json({ group });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const segment = await createNewSegment(req.body, req.user);
    res.status(201).json({ segment });
  } catch (error) {
    next(error);
  }
}

export async function rename(req, res, next) {
  try {
    const segment = await renameExistingSegment(req.params.id, req.body, req.user);
    res.json({ segment });
  } catch (error) {
    next(error);
  }
}

export async function renameGroup(req, res, next) {
  try {
    const group = await renameExistingGroup(req.params.id, req.body, req.user);
    res.json({ group });
  } catch (error) {
    next(error);
  }
}

export async function removeGroup(req, res, next) {
  try {
    const group = await removeExistingGroup(req.params.id, req.user);
    res.json({ group });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const segment = await removeExistingSegment(req.params.id, req.user);
    res.json({ segment });
  } catch (error) {
    next(error);
  }
}
