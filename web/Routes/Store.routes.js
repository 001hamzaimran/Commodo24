import { Router } from "express";
import { getShop } from "../Controller/Store.Controller.js";
import { getShopifyOrder } from "../Controller/Orders.Controller.js";

const storeRouter = Router();

storeRouter.get("/getShop", getShop);
storeRouter.get("/getShopifyOrder", getShopifyOrder);

export default storeRouter;