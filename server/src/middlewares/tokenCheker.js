import jwt from "jsonwebtoken";

const tokenChecker = (req, res, next) => {
    
    const token = req.cookies?.token;
    
    if (!token) {
        // console.log("No token found", res.cookies);
        return res.status(401).json({
            success: false,
            message: "Authentication required. Please log in."
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        return res.status(403).json({
            success: false,
            message: "Session expired or invalid token. Please log in again."
        });
    }
};

export default tokenChecker;