
import storeModel from "../Model/Store.Model.js";
import shopify from "../shopify.js";

export const getShop = async (req, res) => {
    try {
        const Store = await shopify.api.rest.Shop.all({
            session: res.locals.shopify.session,
        });
        if (Store && Store.data && Store.data.length > 0) {
            const store_Name = Store.data[0].name;
            const domain = Store.data[0].domain;
            const country = Store.data[0].country;
            const store_Id = Store.data[0].id;

            // Check if store_Name exists in the database
            let existingStore = await storeModel.findOne({ store_Name });

            if (!existingStore) {
                // If it doesn't exist, save it
                const newStore = new storeModel({
                    store_Name,
                    domain,
                    country,
                    store_Id,
                });
                await newStore.save();
                existingStore = newStore;
            }

            // Send response with existingStore only
            return res.status(200).json(existingStore); // Send existingStore directly in the response
        } else {
            return res.status(404).json({ message: "Store not found" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server Error" });
    }
};

export const addEditTimer = async (req, res) => {
    try {
        const { orderEditTime, domain } = req.body;

        const store = await storeModel.findOne({ domain });

        if (!store) {
            return res.status(404).json({ message: "Store not found" });
        }

        store.orderEditTime = orderEditTime;
        await store.save();

        return res.status(200).json({ message: "Timer updated successfully", store });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server Error" });
    }
};
