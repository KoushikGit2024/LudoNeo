import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  method: { type: String, required: true },
  url: { type: String, required: true },
  ip: { type: String },
  userAgent: { type: String },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    default: null 
  },
  // Stores tiny blueprints instead of raw data
  actionDetails: {
    bodyRef: { type: Object },
    queryRef: { type: Object },
    paramsRef: { type: Object },
    hasFile: { type: Boolean, default: false }
  },
  timestamp: { type: Date, default: Date.now }
});

const Log = mongoose.model("Log", logSchema);
export default Log;