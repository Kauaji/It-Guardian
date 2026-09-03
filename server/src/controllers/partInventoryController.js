import { addPartCategory, createPartInventoryItem, createPartMovement, getPartCategories, getPartInventoryItem, importPurchaseInvoice, listPartInventory, reconcileAgentHardware, removePartCategory, updatePartInventoryItem } from "../services/partInventoryService.js";
export async function list(req,res,next){try{res.json({parts:await listPartInventory(req.query)});}catch(error){next(error);}}
export async function details(req,res,next){try{res.json({part:await getPartInventoryItem(req.params.id)});}catch(error){next(error);}}
export async function create(req,res,next){try{res.status(201).json({part:await createPartInventoryItem(req.body,req.user)});}catch(error){next(error);}}
export async function update(req,res,next){try{res.json({part:await updatePartInventoryItem(req.params.id,req.body,req.user)});}catch(error){next(error);}}
export async function movement(req,res,next){try{res.status(201).json({part:await createPartMovement(req.params.id,req.body,req.user)});}catch(error){next(error);}}
export async function categories(req,res,next){try{res.json({categories:await getPartCategories()});}catch(error){next(error);}}
export async function createCategory(req,res,next){try{res.status(201).json({category:await addPartCategory(req.body,req.user)});}catch(error){next(error);}}
export async function deleteCategory(req,res,next){try{await removePartCategory(req.params.id);res.status(204).end();}catch(error){next(error);}}
export async function syncHardware(req,res,next){try{res.json({summary:await reconcileAgentHardware(req.user)});}catch(error){next(error);}}
export async function importInvoice(req,res,next){try{res.status(201).json({summary:await importPurchaseInvoice(req.body,req.user)});}catch(error){next(error);}}
