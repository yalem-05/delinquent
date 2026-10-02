const jwt = require("jsonwebtoken");
const { validateSession } = require("../services/sessionService");

const userAuth = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      msg: "No token, authorization denied",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // PostgreSQL uses numeric id (NOT _id)
    const userId = decoded.id;

    if (!userId) {
      return res.status(401).json({
        msg: "Invalid token payload",
      });
    }

    if (!decoded.session) {
      return res.status(401).json({
        msg: "Session missing. Please login again.",
      });
    }

    // Validate session in PostgreSQL session table
    const sessionCheck = await validateSession(
      userId,
      decoded.session,
      decoded.deviceId
    );

    if (!sessionCheck.valid) {
      return res.status(401).json({
        msg: sessionCheck.msg,
      });
    }

    // attach user to request
    req.user = {
      id: userId,
      username:decoded.username,
      role: decoded.role,
      session: decoded.session,
      deviceId: decoded.deviceId,
      mustChangePassword: decoded.mustChangePassword || false,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);

    return res.status(401).json({
      msg: "Token invalid or expired",
    });
  }
};

module.exports = userAuth;