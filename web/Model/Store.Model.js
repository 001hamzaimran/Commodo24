import mongoose from "mongoose";

const StoreSchema = new mongoose.Schema({
    store_Id: { type: String, required: true, unique: true },
    domain: { type: String, required: true },
    store_Name: { type: String, required: true },
    country: { type: String, required: true },
    orderEditTime: { type: Number, default: 0 },
}, { timestamps: true });

const storeModel = mongoose.model("Store", StoreSchema)
export default storeModel;