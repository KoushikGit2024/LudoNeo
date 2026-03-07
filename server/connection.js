import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
async function connectMongo() {
    const URL=(process.env.NODE_ENV === "production") ? process.env.MONGO_URL : "mongodb://localhost:27017/ludoneo";
    // console.log(URL)
    try {
        await mongoose.connect(URL);
        // console.log("Connected to MongoDB ",(process.env.NODE_ENV === "production")?"in production":"in development");
    } catch (error) {
        console.log(error);
    }
}

export {connectMongo};
