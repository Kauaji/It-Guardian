import { createPartInventoryItem, createPartMovement, getPartInventoryItem, listPartInventory, updatePartInventoryItem } from "../services/partInventoryService.js";
export async function list(req,res,next){try{res.json({parts:await listPartInventory(req.query)});}catch(error){next(error);}}
export async function details(req,res,next){try{res.json({part:await getPartInventoryItem(req.params.id)});}catch(error){next(error);}}
export async function create(req,res,next){try{res.status(201).json({part:await createPartInventoryItem(req.body,req.user)});}catch(error){next(error);}}
export async function update(req,res,next){try{res.json({part:await updatePartInventoryItem(req.params.id,req.body,req.user)});}catch(error){next(error);}}
export async function movement(req,res,next){try{res.status(201).json({part:await createPartMovement(req.params.id,req.body,req.user)});}catch(error){next(error);}}
