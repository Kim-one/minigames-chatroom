const jwt = require( "jsonwebtoken");

const verifyToken = (req, res, next) => {
    console.log("Auth header received:", req.headers.authorization);

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = decoded;
        next();
    });
};

module.exports = {verifyToken}