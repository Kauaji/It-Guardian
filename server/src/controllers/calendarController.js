import { calendarSummary, cancelEvent, createEvent, eventDetails, listEvents, removeEvent, updateEvent } from "../services/calendarService.js";

export async function list(req, res, next) { try { res.json({ events: await listEvents(req.query, req.user) }); } catch (error) { next(error); } }
export async function details(req, res, next) { try { res.json({ event: await eventDetails(req.params.id, req.user) }); } catch (error) { next(error); } }
export async function create(req, res, next) { try { res.status(201).json({ event: await createEvent(req.body, req.user) }); } catch (error) { next(error); } }
export async function update(req, res, next) { try { res.json({ event: await updateEvent(req.params.id, req.body, req.user) }); } catch (error) { next(error); } }
export async function cancel(req, res, next) { try { res.json({ event: await cancelEvent(req.params.id, req.body?.reason, req.user) }); } catch (error) { next(error); } }
export async function remove(req, res, next) { try { res.json({ event: await removeEvent(req.params.id, req.user) }); } catch (error) { next(error); } }
export async function summary(req, res, next) { try { res.json({ summary: await calendarSummary(req.query, req.user) }); } catch (error) { next(error); } }
