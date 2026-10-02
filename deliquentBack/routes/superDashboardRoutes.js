// routes/adminDashboardRoutes.js
const express = require("express");
const router = express.Router();
const { getDLPool } = require("../config/db");
const userAuth = require("../middleware/userAuth");

router.use(userAuth);

// =====================================================
// GET /api/adminDashboard/stats
// Returns 3 numbers only:
//   - users count
//   - pep count
//   - sanctions count
// =====================================================
router.get("/stats", async (req, res) => {
  try {
    const pool = getDLPool();

    const [usersRes, pepRes, sanctionsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM users`),
      pool.query(`SELECT COUNT(*)::int AS count FROM international_pep`),
      pool.query(`SELECT COUNT(*)::int AS count FROM uk_sanctions_list`),
    ]);

    res.json({
      success: true,
      data: {
        users: usersRes.rows[0].count,
        pep: pepRes.rows[0].count,
        sanctions: sanctionsRes.rows[0].count,
      },
    });
  } catch (err) {
    console.error("❌ Admin dashboard error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
    });
  }
});

module.exports = router;