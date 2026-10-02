// routes/UKSanctionsRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");
const path = require("path");
const { getDLPool } = require("../config/db");
const userAuth = require("../middleware/userAuth");

router.use(userAuth);

// =========================================================
// Constants
// =========================================================
const ALLOWED_EXTENSIONS = [".xml"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_ROWS = 10_000_000;
const CHUNK_SIZE = 3_500;
const TABLE = "uk_sanctions_list";

// =========================================================
// Multer (Memory Storage)
// =========================================================
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(
        new Error(
          `Only ${ALLOWED_EXTENSIONS.join(", ")} files are allowed for UK Sanctions`
        )
      );
    }
    cb(null, true);
  },
});

// =========================================================
// Helpers (mirror the PEP route)
// =========================================================
const toStr = (v) => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return null;
    }
  }
  return String(v).trim() || null;
};

const toDate = (v) => {
  if (!v) return null;
  const str = String(v).trim();
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return str;
};

const ensureArray = (v) => (v ? (Array.isArray(v) ? v : [v]) : []);

/**
 * Parse OFSI-style .xml → array of designation objects.
 * Handles both:
 *   <Designations><Designation>...</Designation></Designations>
 * and
 *   <Designation>...</Designation>
 */
function parseOfsiXml(fileBuffer) {
  const xml = fileBuffer.toString("utf8");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    explicitArray: false,
  });

  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch (e) {
    throw new Error(`Invalid XML: ${e.message}`);
  }

  let designations = [];

  if (parsed?.Designations?.Designation) {
    designations = ensureArray(parsed.Designations.Designation);
  } else if (parsed?.Designation) {
    designations = ensureArray(parsed.Designation);
  } else if (parsed?.Designations) {
    designations = ensureArray(parsed.Designations);
  }

  if (!designations.length) {
    throw new Error("No <Designation> elements found in XML");
  }

  if (designations.length > MAX_ROWS) {
    throw new Error(
      `File has too many designations (${designations.length}). Max: ${MAX_ROWS}`
    );
  }

  return designations;
}

/**
 * Bulk upsert in chunks (respects Postgres parameter limit).
 * uk_sanctions_list has 17 columns.
 */
async function bulkUpsert(client, records) {
  const COLS = 17;
  let total = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);

    const placeholders = chunk
      .map(
        (_, ri) =>
          `(${Array.from(
            { length: COLS },
            (_, c) => `$${ri * COLS + c + 1}`
          ).join(",")})`
      )
      .join(",");

    const flat = chunk.flat();

    const sql = `
      INSERT INTO ${TABLE} (
        unique_id, last_updated, date_designated, ofsi_group_id,
        un_reference_number, names, non_latin_names, regime_name,
        individual_entity_ship, designation_source, sanctions_imposed,
        sanctions_imposed_indicators, other_information,
        uk_statement_of_reasons, addresses, phone_numbers, email_addresses
      ) VALUES ${placeholders}
      ON CONFLICT (unique_id) DO UPDATE SET
        last_updated                 = EXCLUDED.last_updated,
        date_designated              = EXCLUDED.date_designated,
        ofsi_group_id                = EXCLUDED.ofsi_group_id,
        un_reference_number          = EXCLUDED.un_reference_number,
        names                        = EXCLUDED.names,
        non_latin_names              = EXCLUDED.non_latin_names,
        regime_name                  = EXCLUDED.regime_name,
        individual_entity_ship       = EXCLUDED.individual_entity_ship,
        designation_source           = EXCLUDED.designation_source,
        sanctions_imposed            = EXCLUDED.sanctions_imposed,
        sanctions_imposed_indicators = EXCLUDED.sanctions_imposed_indicators,
        other_information            = EXCLUDED.other_information,
        uk_statement_of_reasons      = EXCLUDED.uk_statement_of_reasons,
        addresses                    = EXCLUDED.addresses,
        phone_numbers                = EXCLUDED.phone_numbers,
        email_addresses              = EXCLUDED.email_addresses
    `;

    const result = await client.query(sql, flat);
    total += result.rowCount;
  }

  return total;
}

// =========================================================
// GET /api/list/sanctions
// =========================================================
router.get("/all", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const pool = getDLPool();
    const { rows } = await pool.query(
      `SELECT
         unique_id, names, regime_name, designation_source, sanctions_imposed,
         date_designated, last_updated
       FROM ${TABLE}
       ORDER BY unique_id
       LIMIT $1 OFFSET $2`,
       [limit, offset]
    );
    // console.log("si , ",rows[0].sanctions_imposed);
    const data = rows.map((r) => {
      let primaryName = null;
      try {
        const parsed =
          typeof r.names === "string" ? JSON.parse(r.names) : r.names;
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const n of arr) {
          if (n?.NameType === "Primary Name") {
            primaryName =
              n.Name6 ||
              n.Name1 ||
              n.Name2 ||
              n.Name3 ||
              n.Name4 ||
              n.Name5 ||
              null;
          }
        }
        if (!primaryName && arr[0] && typeof arr[0] === "object") {
          primaryName =
            arr[0].Name6 || arr[0].Name1 || arr[0].Name2 || arr[0].Name3 || null;
        }
      } catch {
        primaryName = typeof r.names === "string" ? r.names : null;
      }
      //console.log("si , ",rows[0].sanctions_imposed);
      return {
        id: r.unique_id,
        name: primaryName,
        sanctions_imposed: r.sanctions_imposed,
        designation_source: r.designation_source,
        regime: r.regime_name,
        date_designated: r.date_designated,
        last_updated: r.last_updated,
      };
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error("GET /api/list/sanctions error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch UK Sanctions list" });
  }
});

// =========================================================
// POST /api/list/sanctions/upload
// =========================================================
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const designations = parseOfsiXml(req.file.buffer);
    if (designations.length === 0) throw new Error("No designations found in file");

    const records = [];
    let skipped = 0;

    for (const desig of designations) {
      const uniqueId = toStr(desig.UniqueID);
      if (!uniqueId) {
        skipped++;
        continue;
      }

      records.push([
        uniqueId,
        toStr(desig.LastUpdated),
        toStr(desig.DateDesignated),
        toStr(desig.OFSIGroupID),
        toStr(desig.UNReferenceNumber),
        desig.Names ? JSON.stringify(ensureArray(desig.Names.Name)) : null,
        desig.NonLatinNames
          ? JSON.stringify(ensureArray(desig.NonLatinNames.NonLatinName))
          : null,
        toStr(desig.RegimeName),
        toStr(desig.IndividualEntityShip),
        toStr(desig.DesignationSource),
        toStr(desig.SanctionsImposed),
        desig.SanctionsImposedIndicators
          ? JSON.stringify(desig.SanctionsImposedIndicators)
          : null,
        toStr(desig.OtherInformation),
        toStr(desig.UKStatementofReasons),
        desig.Addresses
          ? JSON.stringify(ensureArray(desig.Addresses.Address))
          : null,
        desig.PhoneNumbers
          ? JSON.stringify(ensureArray(desig.PhoneNumbers.PhoneNumber))
          : null,
        desig.EmailAddresses
          ? JSON.stringify(ensureArray(desig.EmailAddresses.EmailAddress))
          : null,
      ]);
    }

    if (records.length === 0) {
      throw new Error(
        `No valid rows to insert. Skipped ${skipped} row(s) missing required 'UniqueID'`
      );
    }

    const pool = getDLPool();
    const client = await pool.connect();
    let inserted = 0;

    try {
      await client.query("BEGIN");
      await client.query(`TRUNCATE TABLE ${TABLE} RESTART IDENTITY CASCADE`);
      inserted = await bulkUpsert(client, records);
      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: `UK Sanctions list updated: ${inserted} record(s)`,
      recordsProcessed: inserted,
      recordsSkipped: skipped,
      totalRows: designations.length,
    });
  } catch (err) {
    console.error("UK Sanctions upload error:", err.message);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to process file",
    });
  }
});

module.exports = router;