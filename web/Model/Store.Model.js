import mongoose from "mongoose";

const StoreSchema = new mongoose.Schema({
    store_Id: { type: String, required: true, unique: true },
    domain: { type: String, required: true },
    store_Name: { type: String, required: true },
    country: { type: String, required: true },
    ShopifyFeeRate: { type: Number, default: 4 },
    PaymentProviderFee: { type: Number, default: 0 },
    comodoCommissionRate: { type: Number, default: 30 },
    immediatePayoutShare: { type: Number, default: 75 },
    holdBackShare: { type: Number, default: 25 },
    holdBackDays: { type: Number, default: 14 },
    store_Currency: { type: String, required: true }
}, { timestamps: true });

const storeModel = mongoose.model("Store", StoreSchema)
export default storeModel;