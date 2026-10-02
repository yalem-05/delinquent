const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/userAuth");
const { getDLPool } = require("../config/db");

const {
  createSession,
  invalidateSession,
} = require("../services/sessionService");

const {
  validateComplexPassword,
  isDefaultPassword,
} = require("../utils/passwordValidation");

const router = express.Router();

/* =========================
   JWT SIGNER (FIXED)
========================= */
function signUserToken(user, mustChangePassword, sessionToken, deviceId) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,              // ✅ PG FIX
      username: user.username,
      role: user.role,
      mustChangePassword,
      session: sessionToken,      // ✅ unified name
      deviceId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

/* =========================
   LOGIN (POSTGRES)
========================= */
router.post("/login", async (req, res) => {
  try {
    const { username, password, deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ msg: "Device ID is required." });
    }

    const pool = getDLPool();

    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE username = $1 AND enabled = true
      `,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // ✅ SESSION
    const { sessionToken } = await createSession(
      user.id,
      deviceId,
      req.ip,
      req.get("user-agent")
    );

    const mustChangePassword = await isDefaultPassword(user);

    const token = signUserToken(
      user,
      mustChangePassword,
      sessionToken,
      deviceId
    );

    return res.json({
      token,
      username: user.username,
      role: user.role,
      mustChangePassword,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================
   LOGOUT (SESSION BASED FIX)
========================= */
router.post("/logout", auth, async (req, res) => {
  try {
    // ✅ IMPORTANT FIX: use session-aware logout
    await invalidateSession(req.user.id);

    return res.json({ msg: "Logged out successfully." });

  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

/* =========================
   CHANGE PASSWORD
========================= */
router.patch("/change-password", auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ msg: "Please fill all fields." });
    }

    const validation = validateComplexPassword(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ msg: validation.msg });
    }

    const pool = getDLPool();

    const result = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Old password is incorrect." });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({
        msg: "New password must be different."
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [hashed, req.user.id]
    );

    await invalidateSession(req.user.id);

    return res.json({
      msg: "Password changed successfully. Please login again.",
      mustChangePassword: false
    });

  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;