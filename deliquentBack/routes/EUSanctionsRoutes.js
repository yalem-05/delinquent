// routes/EUSanctionsRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const sax = require("sax");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { getDLPool } = require("../config/db");

// =========================================================
// Constants
// =========================================================
const ALLOWED_EXTENSIONS = [".xml"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const CHUNK_SIZE = 500; // rows per INSERT (lower = safer)
const TABLE = "eu_sanctions_list";
const userAuth = require("../middleware/userAuth");

router.use(userAuth);
const INSERT_COLUMNS = [
  "logical_id",
  "eu_reference_number",
  "united_nation_id",
  "designation_details",
  "remark",
  "subject_type_code",
  "classification_code",
  "whole_name",
  "first_name",
  "middle_name",
  "last_name",
  "name_language",
  "is_strong",
  "gender",
  "title",
  "function",
  "country_iso2_code",
  "country_description",
  "birth_date",
  "birth_year",
  "birth_month",
  "birth_day",
  "birth_city",
  "birth_region",
  "birth_country_iso2_code",
  "birth_country_description",
  "circa",
  "calendar_type",
  "regulation_type",
  "organisation_type",
  "publication_date",
  "entry_into_force_date",
  "number_title",
  "programme",
  "publication_url"
];

// =========================================================
// Multer (disk storage for large files + SAX streaming)
// =========================================================
const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (req, file, cb) => {
    cb(null, `eu-${Date.now()}.xml`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(
        new Error(
          `Only ${ALLOWED_EXTENSIONS.join(", ")} files are allowed for EU Sanctions`
        )
      );
    }
    cb(null, true);
  },
});

// =========================================================
// Helpers
// =========================================================
async function bulkInsert(client, rows) {
  if (!rows.length) return 0;
  const COLS = INSERT_COLUMNS.length;

  const placeholders = rows
    .map((_, ri) => {
      const base = ri * COLS;
      const inner = Array.from({ length: COLS }, (_, c) => `$${base + c + 1}`).join(",");
      return `(${inner})`;
    })
    .join(",");

  const flat = rows.flat();
  const sql = `INSERT INTO ${TABLE} (${INSERT_COLUMNS.join(", ")}) VALUES ${placeholders}`;
  const result = await client.query(sql, flat);
  return result.rowCount;
}

// =========================================================
// GET /api/list/eusanctions/all
// =========================================================
router.get("/all", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const pool = getDLPool();
    // For list view, let's group by logical_id to return one row per entity
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (logical_id)
         logical_id as id,
         whole_name as name,
         eu_reference_number,
         united_nation_id,
         designation_details,
         remark,
         subject_type_code as subject_type,
         classification_code,
         updated_at
       FROM ${TABLE}
       ORDER BY logical_id, is_strong DESC, id ASC
       LIMIT ${limit} OFFSET ${offset}`
    );

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error("GET /api/list/eusanctions error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch EU Sanctions list" });
  }
});

// =========================================================
// GET /api/list/eusanctions/search?name=Hambali
// =========================================================
router.get("/search/name", async (req, res) => {
  try {
    const name = (req.query.name || "").trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Query param 'name' is required" });
    }

    const pool = getDLPool();
    const { rows } = await pool.query(
      `SELECT
          logical_id,
          eu_reference_number,
          united_nation_id,
          remark,
          subject_type_code as subject_type,
          whole_name,
          first_name,
          last_name,
          function,
          gender,
          number_title as regulation_number,
          publication_date as regulation_date,
          similarity(whole_name, $1) AS score
        FROM ${TABLE}
        WHERE whole_name ILIKE '%' || $1 || '%'
        ORDER BY
          CASE WHEN lower(whole_name) = lower($1) THEN 0 ELSE 1 END,
          similarity(whole_name, $1) DESC,
          whole_name
        LIMIT 100`,
      [name]
    );

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error("GET /api/list/eusanctions/search error:", err);
    res.status(500).json({ success: false, message: "Failed to search EU Sanctions" });
  }
});

// =========================================================
// GET /api/list/eusanctions/:logicalId
// =========================================================
router.get("/:logicalId", async (req, res) => {
  try {
    const { logicalId } = req.params;
    const pool = getDLPool();
    const { rows } = await pool.query(
      `SELECT * FROM ${TABLE} WHERE logical_id = $1`,
      [logicalId]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    // Return all aliases for this logicalId
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /api/list/eusanctions/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch entity" });
  }
});

// =========================================================
// POST /api/list/eusanctions/upload
// =========================================================
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const pool = getDLPool();
  const client = await pool.connect();
  let insertedCount = 0;

    try {
    await client.query("BEGIN");
    await client.query(`TRUNCATE TABLE ${TABLE} RESTART IDENTITY CASCADE`);

    // Optional: clear the table first? The user usually clears it in importFileDb.js
    // Let's assume we append or the user drops the table via importFileDb.js.

    let currentEntity = null;
    let currentName = null;
    let rowsToInsert = [];

    const flushRows = async () => {
      if (rowsToInsert.length > 0) {
        const rows = rowsToInsert;
        rowsToInsert = [];
        insertedCount += await bulkInsert(client, rows);
      }
    };

    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(req.file.path, { encoding: "utf8" });
      const parser = sax.createStream(true, { trim: true, normalize: true });

      parser.on("opentag", (node) => {
        if (node.name === "sanctionEntity") {
          currentEntity = {
            logicalId: node.attributes.logicalId || null,
            euReferenceNumber: node.attributes.euReferenceNumber || null,
            unitedNationId: node.attributes.unitedNationId || null,
            designationDetails: node.attributes.designationDetails || null,
            remark: null,
            subjectType: null,
            classificationCode: null,
            nameAliases: [],
            citizenships: [],
            birthdates: [],
            regulations: []
          };
        } else if (currentEntity && node.name === "remark") {
          currentEntity._collect = "remark";
        } else if (currentEntity && node.name === "subjectType") {
          currentEntity.subjectType = node.attributes.code || null;
          currentEntity.classificationCode = node.attributes.classificationCode || null;
        } else if (currentEntity && node.name === "nameAlias") {
          currentName = { ...node.attributes };
        } else if (currentEntity && node.name === "citizenship") {
          currentEntity.citizenships.push({ ...node.attributes });
        } else if (currentEntity && node.name === "birthdate") {
          currentEntity.birthdates.push({ ...node.attributes });
        } else if (currentEntity && node.name === "regulation") {
          currentEntity.regulations.push({ ...node.attributes });
        }
      });

      parser.on("text", (text) => {
        if (currentEntity && currentEntity._collect) {
          if (currentEntity._collect === "remark") {
            currentEntity.remark = text;
          }
          currentEntity._collect = null;
        }
      });

      parser.on("closetag", async (tagName) => {
        try {
          if (tagName === "sanctionEntity") {
            const entity = currentEntity;
            currentEntity = null; // Clear synchronously to prevent async race conditions
            
            if (!entity) return;

            if (entity.nameAliases.length === 0) {
              // Create a dummy name to ensure at least one row is inserted
              entity.nameAliases.push({
                wholeName: "Unknown",
                strong: "false"
              });
            }

            // In a fully normalized system we might Cartesian product, but here we'll just take the first birth/citizenship/regulation to keep it simple, or associate with the main entity.
            const b = entity.birthdates[0] || {};
            const c = entity.citizenships[0] || {};
            const r = entity.regulations[0] || {};

            for (const name of entity.nameAliases) {
              const row = [
                entity.logicalId,
                entity.euReferenceNumber,
                entity.unitedNationId,
                entity.designationDetails,
                entity.remark,
                entity.subjectType,
                entity.classificationCode,

                name.wholeName,
                name.firstName || null,
                name.middleName || null,
                name.lastName || null,
                name.nameLanguage || null,
                name.strong === "true",
                name.gender || null,
                name.title || null,
                name.function || null,

                c.countryIso2Code || null,
                c.countryDescription || null,

                b.birthdate || null,
                b.year ? parseInt(b.year) : null,
                b.monthOfYear ? parseInt(b.monthOfYear) : null,
                b.dayOfMonth ? parseInt(b.dayOfMonth) : null,
                b.city || null,
                b.region || null,
                b.countryIso2Code || null,
                b.countryDescription || null,
                b.circa === "true",
                b.calendarType || null,

                r.regulationType || null,
                r.organisationType || null,
                r.publicationDate || null,
                r.entryIntoForceDate || null,
                r.numberTitle || null,
                r.programme || null,
                r.publicationUrl || null // simplified
              ];
              rowsToInsert.push(row);
            }

            if (rowsToInsert.length >= CHUNK_SIZE) {
              stream.pause();
              await flushRows();
              stream.resume();
            }
          } else if (tagName === "nameAlias") {
            if (currentEntity && currentName) {
              currentEntity.nameAliases.push(currentName);
            }
            currentName = null;
          }
        } catch (e) {
          stream.destroy();
          reject(e);
        }
      });

      parser.on("error", (err) => {
        reject(err);
      });

      parser.on("end", async () => {
        try {
          await flushRows();
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      stream.pipe(parser);
    });

    if (insertedCount === 0) {
      throw new Error("Invalid XML format or no valid records found. Table was not updated.");
    }
    await client.query("COMMIT");

    res.json({
      success: true,
      message: `EU Sanctions list updated: ${insertedCount} record(s)`,
      recordsProcessed: insertedCount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("EU Sanctions upload error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to process file",
    });
  } finally {
    client.release();
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// =========================================================
// DELETE /api/list/eusanctions/:logicalId  (soft delete)
// =========================================================
router.delete("/:logicalId", async (req, res) => {
  try {
    const { logicalId } = req.params;
    const pool = getDLPool();
    const result = await pool.query(
      `DELETE FROM ${TABLE} WHERE logical_id = $1`,
      [logicalId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Not found or already deleted" });
    }
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/list/eusanctions/:id error:", err);
    res.status(500).json({ success: false, message: "Failed to delete entity" });
  }
});

module.exports = router;