import { Router } from "express";
import { createStoreSettings ,getStoreSettings } from "../Controller/Store.Controller.js";

const settingsRouter = Router();

settingsRouter.post("/createSettings", createStoreSettings);
settingsRouter.post("/getSettings" , getStoreSettings);

export default settingsRouter;