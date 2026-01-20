import mongoose from 'mongoose';

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    try {
        await mongoose.connect("mongodb+srv://admin:admin@oktopuslab.hgowwqx.mongodb.net/Commodo24");
        console.log('MongoDB connected');
    }
    catch (error) {
        console.error(error);
    }
};

export default connectDB;