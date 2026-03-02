
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
            const store_Currency = Store.data[0].currency;

            console.log(store_Name, domain, country, store_Id, store_Currency, " <<<<< store details")
            // Check if store_Name exists in the database
            let existingStore = await storeModel.findOne({ store_Name });

            if (!existingStore) {
                // If it doesn't exist, save it
                const newStore = new storeModel({
                    store_Name,
                    domain,
                    country,
                    store_Id,
                    store_Currency
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

export const createStoreSettings = async (req, res) => {
    try {
        const {
            domain,
            ShopifyFeeRate,
            PaymentProviderFee,
            comodoCommissionRate,
            immediatePayoutShare,
            holdBackShare,
            holdBackDays
        } = req.body;

        if (!domain) {
            return res.status(400).json({ message: "Domain is required" })
        }

        const store = await storeModel.findOne({ domain })

        if (!store) {
            return res.status(404).json({ message: "Store not found" });
        }

        store.ShopifyFeeRate = ShopifyFeeRate;
        store.PaymentProviderFee = PaymentProviderFee;
        store.comodoCommissionRate = comodoCommissionRate;
        store.immediatePayoutShare = immediatePayoutShare;
        store.holdBackShare = holdBackShare;
        store.holdBackDays = holdBackDays;

        await store.save();

        return res.status(200).json({ message: "Settings Update Successfully", store })
    } catch (error) {
        console.log(error, " <<<<<, error")
        return res.status(500).json({ message: "Internal Server Error", error })
    }
}

export const getStoreSettings = async (req, res) => {
    try {
        const { domain } = req.body;

        if (!domain) {
            return res.status(400).json({ message: "Domain is required" })
        }
        const store = await storeModel.findOne({ domain })
        if (!store) {
            return res.status(404).json({ message: "Store Not Found" })
        }

        return res.status(200).json({ message: "Settings fetched successfully", store })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Internal Server Error", err })
    }
}