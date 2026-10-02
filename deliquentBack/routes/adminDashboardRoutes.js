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

    const [
      usersRes,
      pepRes,
      ukSanctionsRes,
      euSanctionsRes,
      ofacRes,
      unSanctionsRes,
      unDesignatedRes,
      blackListRes,
      deliquentListRes,
      ethListRes,
      localPepsRes,
      pepAdverserRes
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM users`),
      pool.query(`SELECT COUNT(*)::int AS count FROM international_pep`),
      pool.query(`SELECT COUNT(*)::int AS count FROM uk_sanctions_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM eu_sanctions_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM ofac_sanctions_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM un_sanctions_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM un_designated_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM black_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM deliquent_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM eth_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM pep_list`),
      pool.query(`SELECT COUNT(*)::int AS count FROM pep_adverser_list`),
    ]);

    res.json({
      success: true,
      data: {
        users: usersRes.rows[0].count,
        international_pep: pepRes.rows[0].count,
        uk_sanctions: ukSanctionsRes.rows[0].count,
        eu_sanctions: euSanctionsRes.rows[0].count,
        ofac_sanctions: ofacRes.rows[0].count,
        un_sanctions: unSanctionsRes.rows[0].count,
        un_designated: unDesignatedRes.rows[0].count,
        black_list: blackListRes.rows[0].count,
        deliquent_list: deliquentListRes.rows[0].count,
        eth_list: ethListRes.rows[0].count,
        local_peps: localPepsRes.rows[0].count,
        pep_adverser: pepAdverserRes.rows[0].count,
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