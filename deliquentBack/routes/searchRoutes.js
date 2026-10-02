// server/routes/searchRoutes.js
const express = require("express");
const router = express.Router();
const { getDLPool } = require("../config/db");
const userAuth = require("../middleware/userAuth");

// =====================================================
// AUTH MIDDLEWARE
// =====================================================
// router.use(userAuth);

// =====================================================
// CONSTANTS
// =====================================================
const TABLE_PEP = "international_pep";
const TABLE_SANCTIONS = "uk_sanctions_list";

// =====================================================
// GET /api/search/all?name=<query>
// Search both tables by name (PEP + UK Sanctions)
// =====================================================
router.get("/all", async (req, res) => {
  const { name } = req.query;

  if (!name || !name.trim()) {
    return res
      .status(400)
      .json({ success: false, error: "Please provide a name to search for" });
  }

  // Escape ILIKE wildcards in user input
  const safeTerm = String(name).trim().replace(/[%_\\]/g, "\\$&");
  const searchTerm = `%${safeTerm}%`;

  try {
    const pool = getDLPool();

    const [
      pepResult,
      ukSanctionsResult,
      euSanctionsResult,
      blackListResult,
      deliquentResult,
      ethResult,
      localPepResult,
      pepAdverserResult,
      ofacResult,
      unResult,
      unDesignatedResult
    ] = await Promise.all([
      pool.query(
        `
        SELECT *
        FROM ${TABLE_PEP}
        WHERE name ILIKE $1 OR aliases ILIKE $1
        ORDER BY name
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM ${TABLE_SANCTIONS}
        WHERE names ILIKE $1 OR non_latin_names ILIKE $1
        ORDER BY unique_id
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT
          logical_id,
          eu_reference_number,
          remark,
          subject_type_code as subject_type,
          whole_name,
          function,
          gender,
          country_description,
          number_title as regulation_number,
          publication_date as regulation_date
        FROM eu_sanctions_list
        WHERE whole_name ILIKE $1
        ORDER BY whole_name
        LIMIT 1000
         `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM black_list
        WHERE name_of_suspected ILIKE $1 OR phone_no ILIKE $1
        ORDER BY id
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM deliquent_list
        WHERE customer_name ILIKE $1 OR tin ILIKE $1
        ORDER BY no
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM eth_list
        WHERE name ILIKE $1
        ORDER BY sn
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM pep_list
        WHERE nameeng ILIKE $1 OR nameamh ILIKE $1
        ORDER BY id
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM pep_adverser_list
        WHERE name ILIKE $1
        ORDER BY id
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM ofac_sanctions_list
        WHERE primary_name ILIKE $1 OR aliases ILIKE $1
        ORDER BY id
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM un_sanctions_list
        WHERE first_name ILIKE $1 OR second_name ILIKE $1 OR aliases ILIKE $1
        ORDER BY id
        LIMIT 1000
        `,
        [searchTerm]
      ),
      pool.query(
        `
        SELECT *
        FROM un_designated_list
        WHERE first_name ILIKE $1 OR second_name ILIKE $1 OR aliases ILIKE $1
        ORDER BY id
        LIMIT 1000
        `,
        [searchTerm]
      )
    ]);
    const responseData = {
      success: true,
      International_PEPs: pepResult.rows,
      UK_Sanctions_List: ukSanctionsResult.rows,
      EU_Sanctions_List: euSanctionsResult.rows,
      OFAC_Sanctions_List: ofacResult.rows,
      UN_Sanctions_List: unResult.rows,
      UN_Designated_List: unDesignatedResult.rows,
      Black_List: blackListResult.rows,
      Deliquent_List: deliquentResult.rows,
      ETH_List: ethResult.rows,
      Local_PEPs: localPepResult.rows,
      PEP_Adverser_List: pepAdverserResult.rows,
    };

    // Log the actual data object, not the Express response function
    // console.log("Search Results:", JSON.stringify(responseData, null, 2));

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Error searching data:", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error during search", details: err.message, stack: err.stack });
  }
});

module.exports = router;