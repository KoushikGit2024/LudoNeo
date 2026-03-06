// import express from "express";
import multer from "multer";
// import { registerUser } from "../controllers/authController.js";

// const authRoute = express.Router();

// Setup Multer (Memory storage is best for small profile pics)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2.5 * 1024 * 1024 // 2MB limit in bytes
    },
    fileFilter: (req, file, cb) => {
        // Only allow common image formats
        if (file.mimetype.startsWith('image/')) {
            // console.log("file", file);
            cb(null, true);
        } else {
            cb(new Error("Only images are allowed!"), false);
        }
        // console.log("file", file);
    }
});

// Use upload.single('avatar') to catch the image file from the frontend
// authRoute.post("/register", upload.single('avatar'), registerUser);

export default upload;