const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { getDLPool } = require("../config/db");
const userAuth = require("../middleware/userAuth");

// =====================================================
// AUTH MIDDLEWARE
// =====================================================
router.use(userAuth);

// SUPER ADMIN ONLY
const superAdminOnly = (req, res, next) => {
  if (req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Access denied. SUPER_ADMIN only.",
    });
  }
  next();
};

router.use(superAdminOnly);

// =====================================================
// GET ALL ADMINS
// =====================================================
router.get("/", async (req, res) => {
  try {
    const pool = getDLPool();
console.log("fetching admins ");
    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.name,
        u.enabled,
        u.role,
        u.created_at,
        u.created_by,
        c.name AS created_by_name
      FROM users u
      LEFT JOIN users c ON c.id = u.created_by
      ORDER BY u.id DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// GET ADMIN BY ID
// =====================================================
router.get("/:id", async (req, res) => {
  try {
    const pool = getDLPool();

    const result = await pool.query(
      `
      SELECT id, username, name, enabled, created_by, created_at
      FROM users
      WHERE id = $1 AND role = 'ADMIN'
    `,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// CREATE ADMIN
// =====================================================
router.post("/", async (req, res) => {
  try {
    const pool = getDLPool();
    const { username, name, password } = req.body;
    console.log("password : ",password);    

    if (!username || !name || !password) {
      return res.status(400).json({
        success: false,
        message: "username, name and password required",
      });
    }

    // check existing
    const exists = await pool.query(
      `SELECT id FROM users WHERE username = $1`,
      [username]
    );

    if (exists.rows.length) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (username, name, password, role, enabled, created_by)
      VALUES ($1, $2, $3, 'ADMIN', true, $4)
      RETURNING id, username, name, role, enabled, created_at
    `,
      [username, name, hashed, req.user.id]
    );

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// UPDATE ADMIN
// =====================================================
router.put("/:id", async (req, res) => {
  try {
    const pool = getDLPool();
    const { username, name, enabled } = req.body;

    const result = await pool.query(
      `
      UPDATE users
      SET
        username = COALESCE($1, username),
        name = COALESCE($2, name),
        enabled = COALESCE($3, enabled)
      WHERE id = $4 AND role = 'ADMIN'
      RETURNING id, username, name, enabled
    `,
      [username, name, enabled, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json({
      success: true,
      message: "Admin updated",
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// TOGGLE ENABLED STATUS
// =====================================================
router.patch("/:id/toggle", async (req, res) => {
  try {
    const pool = getDLPool();

    const current = await pool.query(
      `
      SELECT enabled FROM users
      WHERE id = $1 AND role = 'ADMIN'
    `,
      [req.params.id]
    );

    if (!current.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const newStatus = !current.rows[0].enabled;

    const result = await pool.query(
      `
      UPDATE users
      SET enabled = $1
      WHERE id = $2
      RETURNING id, enabled
    `,
      [newStatus, req.params.id]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// RESET PASSWORD
// =====================================================
router.patch("/:id/reset-password", async (req, res) => {
  try {
    const pool = getDLPool();
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password required",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2 AND role = 'ADMIN'
    `,
      [hashed, req.params.id]
    );

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// DELETE ADMIN
// =====================================================
router.delete("/:id", async (req, res) => {
  try {
    const pool = getDLPool();

    // remove sessions first
    await pool.query(
      `
      DELETE FROM sessions WHERE user_id = $1
    `,
      [req.params.id]
    );

    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1 AND role = 'ADMIN'
      RETURNING id
    `,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json({
      success: true,
      message: "Admin deleted",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// =====================================================
// GET ADMIN SESSIONS
// =====================================================
router.get("/:id/sessions", async (req, res) => {
  try {
    const pool = getDLPool();

    const result = await pool.query(
      `
      SELECT *
      FROM sessions
      WHERE user_id = $1
      ORDER BY last_activity DESC
    `,
      [req.params.id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;