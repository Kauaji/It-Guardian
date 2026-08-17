import {
  clientService,
  priorityRuleService,
  problemTypeService,
  productService,
  serviceOfferingService,
  technicianService
} from "../services/settingsService.js";

function createController(service, resource, label) {
  return {
    async list(req, res, next) {
      try {
        const records = await service.list(req.query.search);
        res.json({ [resource]: records });
      } catch (error) {
        next(error);
      }
    },

    async details(req, res, next) {
      try {
        const record = await service.details(req.params.id);
        res.json({ [label]: record });
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next) {
      try {
        const record = await service.create(req.body, req.user);
        res.status(201).json({ [label]: record });
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        const record = await service.update(req.params.id, req.body, req.user);
        res.json({ [label]: record });
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        const record = await service.remove(req.params.id, req.user);
        res.json({ [label]: record });
      } catch (error) {
        next(error);
      }
    },

    async importCsv(req, res, next) {
      try {
        const result = await service.importCsv(req.body.csv, req.user);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  };
}

export const clientController = createController(clientService, "clients", "client");
export const productController = createController(productService, "products", "product");
export const serviceController = createController(serviceOfferingService, "services", "service");
export const technicianController = createController(technicianService, "technicians", "technician");
export const problemTypeController = createController(problemTypeService, "problemTypes", "problemType");
export const priorityRuleController = createController(priorityRuleService, "priorityRules", "priorityRule");
