import { Router } from "express";
import { getShop } from "../Controller/Store.Controller.js";

const storeRouter = Router();

storeRouter.get("/getShop", getShop);

export default storeRouter;