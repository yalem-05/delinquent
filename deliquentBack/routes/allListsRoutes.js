const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const { getDLPool } = require("../config/db");
const userAuth = require("../middleware/userAuth");

router.use(userAuth);

// =========================================================
// Constants & Configuration
// =========================================================
const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];
const MAX_FILE_SIZE = 700 * 1024 * 1024; // 500 MB
const MAX_ROWS = 10_000_000;
const CHUNK_SIZE = 3_500;

const listConfig = {
  blacklist: {
    table: "black_list",
    pk: "id",
    columns: ["id", "name_of_suspected", "predicate_offence", "phone_no"],
    expectedHeaders: [
      ["id", "no", "sn", "s/n"],
      ["name_of_suspected", "name", "suspect_name"],
      ["predicate_offence", "offence", "crime"]
    ],
    extract: (get) => [
      toStr(get("id", "no", "sn", "s/n")),
      toStr(get("name_of_suspected", "name", "suspect_name")),
      toStr(get("predicate_offence", "offence", "crime")),
      toStr(get("phone_no", "phone", "contact", "phone no.")),
    ],
  },
  deliquent: {
    table: "deliquent_list",
    pk: "no",
    columns: ["no", "customer_name", "tin", "reference_no"],
    expectedHeaders: [
      ["no"],
      ["customer_name", "customers_name", "name", "customer"],
      ["tin", "tax_id"],
      ["reference_no", "referance_no", "reference", "ref_no"]
    ],
    extract: (get) => [
      toStr(get("no")),
      toStr(get("customer_name", "customers_name", "name", "customer")),
      toStr(get("tin", "tax_id")),
      toStr(get("reference_no", "referance_no", "reference", "ref_no")),
    ],
  },
  eth: {
    table: "eth_list",
    pk: "sn",
    columns: ["sn", "name", "detail"],
    expectedHeaders: [
      ["sn", "s/n"],
      ["name"],
      ["detail", "details"]
    ],
    extract: (get) => [
      toStr(get("sn", "s/n")),
      toStr(get("name")),
      toStr(get("detail", "details")),
    ],
  },
  pep: {
    table: "pep_list",
    pk: "id",
    columns: ["id", "nameeng", "nameamh", "position", "placeofassignment", "detail"],
    expectedHeaders: [
      ["id"],
      ["nameeng", "name_eng", "english_name"],
      ["nameamh", "name_amh", "amharic_name"]
    ],
    extract: (get) => [
      toStr(get("id")),
      toStr(get("nameeng", "name_eng", "english_name")),
      toStr(get("nameamh", "name_amh", "amharic_name")),
      toStr(get("position")),
      toStr(get("placeofassignment", "place_of_assignment", "assignment")),
      toStr(get("detail", "details")),
    ],
  },
  pepadverser: {
    table: "pep_adverser_list",
    pk: "id",
    columns: ["id", "name", "relation", "position"],
    expectedHeaders: [
      ["id"],
      ["name"],
      ["relation", "relationship"]
    ],
    extract: (get) => [
      toStr(get("id")),
      toStr(get("name")),
      toStr(get("relation", "relationship")),
      toStr(get("position")),
    ],
  },
};

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
          `Only ${ALLOWED_EXTENSIONS.join(", ")} files are allowed for this upload`
        )
      );
    }
    cb(null, true);
  },
});

// =========================================================
// Helpers
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

const buildRowGetter = (row) => {
  const keyMap = new Map();
  for (const k of Object.keys(row)) {
    keyMap.set(k.toLowerCase().replace(/[^a-z0-9]/g, ""), k);
  }
  return (...candidates) => {
    for (const c of candidates) {
      const norm = String(c).toLowerCase().replace(/[^a-z0-9]/g, "");
      const realKey = keyMap.get(norm);
      if (realKey !== undefined) {
        const v = row[realKey];
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return null;
  };
};

function parseSpreadsheet(fileBuffer, ext) {
  let workbook;
  if (ext === ".xlsx") {
    workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true, codepage: 65001 });
  } else {
    const text = fileBuffer.toString("utf8");
    workbook = XLSX.read(text, {
      type: "string",
      cellDates: true,
      codepage: 65001,
    });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("No sheets found in file");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  if (rows.length > MAX_ROWS) {
    throw new Error(`File has too many rows (${rows.length}). Max: ${MAX_ROWS}`);
  }
  return rows;
}

async function bulkUpsert(client, config, records) {
  const { table, pk, columns } = config;
  const COLS = columns.length;
  let total = 0;

  // Filter out the primary key from the columns to update
  const updateCols = columns.filter(col => col !== pk);
  const updateSet = updateCols.map(col => `${col} = EXCLUDED.${col}`).join(", ");

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
      INSERT INTO ${table} (
        ${columns.join(", ")}
      ) VALUES ${placeholders}
      ON CONFLICT (${pk}) DO UPDATE SET
        ${updateSet}
    `;

    const result = await client.query(sql, flat);
    total += chunk.length;
  }

  return total;
}

// =========================================================
// GET /api/list/local/:type
// =========================================================
router.get("/:type", async (req, res) => {
  const { type } = req.params;
  const config = listConfig[type];

  if (!config) {
    return res.status(400).json({ success: false, message: "Invalid list type" });
  }

  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = req.query.search;

    const pool = getDLPool();
    let queryStr = `SELECT * FROM ${config.table}`;
    let countQueryStr = `SELECT COUNT(*) FROM ${config.table}`;
    let params = [];

    if (search) {
      const nameCol = config.table === 'black_list' ? 'name_of_suspected'
        : config.table === 'deliquent_list' ? 'customer_name'
          : config.table === 'pep_list' ? 'nameeng'
            : 'name';

      const safeSearch = String(search).trim().replace(/[%_\\]/g, "\\$&");
      queryStr += ` WHERE ${nameCol} ILIKE $1`;
      countQueryStr += ` WHERE ${nameCol} ILIKE $1`;
      params.push(`%${safeSearch}%`);
    }

    queryStr += ` ORDER BY ${config.pk} ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    let countParams = search ? [`%${String(search).trim().replace(/[%_\\]/g, "\\$&")}%`] : [];

    const countRes = await pool.query(countQueryStr, countParams);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    console.log('offset are ', offset, 'limit are', limit, 'table is', config.table)
    const { rows } = await pool.query(queryStr, params);

    res.json({ success: true, count: totalCount, data: rows });
  } catch (err) {
    console.error(`GET /api/list/local/${type} error:`, err);
    res
      .status(500)
      .json({ success: false, message: `Failed to fetch ${type} list` });
  }
});

// =========================================================
// POST /api/list/local/:type/upload
// =========================================================
router.post("/:type/upload", upload.single("file"), async (req, res) => {
  const { type } = req.params;
  const config = listConfig[type];

  if (!config) {
    return res.status(400).json({ success: false, message: "Invalid list type" });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    const rows = parseSpreadsheet(req.file.buffer, ext);
    if (rows.length === 0) throw new Error("No rows found in file");

    // Validate headers
    const fileHeaders = Object.keys(rows[0]).map((k) =>
      k.toLowerCase().replace(/[^a-z0-9]/g, "")
    );

    if (config.expectedHeaders) {
      for (const synonyms of config.expectedHeaders) {
        const normalizedSynonyms = synonyms.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ""));
        const found = fileHeaders.some((fh) => normalizedSynonyms.includes(fh));
        if (!found) {
          throw new Error(`Invalid file format. Missing required column (e.g., "${synonyms[0]}").`);
        }
      }
    }

    const records = [];

    for (const raw of rows) {
      const get = buildRowGetter(raw);
      const rowData = config.extract(get);

      // Basic validation: skip row if all extracted fields are null
      if (rowData.every(val => val === null)) {
        continue;
      }

      records.push(rowData);
    }

    if (records.length === 0) {
      throw new Error(`No valid rows to insert.`);
    }

    const pool = getDLPool();
    const client = await pool.connect();
    let inserted = 0;

    try {
      await client.query("BEGIN");

      inserted = await bulkUpsert(client, config, records);
      await client.query("COMMIT");
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: `${type} list updated: ${inserted} record(s)`,
      recordsProcessed: inserted,
      totalRows: rows.length,
    });
  } catch (err) {
    console.error(`${type} upload error:`, err.message);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to process file",
    });
  }
});

// =========================================================
// PUT /api/list/local/:type/:id
// =========================================================
router.put("/:type/:id", userAuth, async (req, res) => {
  const { type, id } = req.params;
  const config = listConfig[type];

  if (!config) {
    return res.status(400).json({ success: false, message: "Invalid list type" });
  }

  const updateFields = req.body;

  // Remove pk from update fields just in case
  delete updateFields[config.pk];

  const keys = Object.keys(updateFields).filter(key => config.columns.includes(key));
  if (keys.length === 0) {
    return res.status(400).json({ success: false, message: "No valid fields provided for update" });
  }

  const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(", ");
  const values = keys.map(key => updateFields[key]);
  values.push(id);

  try {
    const pool = getDLPool();

    // Fetch existing record to get its name
    const existingResult = await pool.query(`SELECT * FROM ${config.table} WHERE ${config.pk} = $1`, [id]);
    if (existingResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    const existingRecord = existingResult.rows[0];

    // Extract the name based on the table's specific name column
    let recordName = existingRecord.name || existingRecord.name_of_suspected || existingRecord.customer_name || existingRecord.nameeng || "Unknown";
    // Check if name is being updated
    if (updateFields.name) recordName = updateFields.name;
    if (updateFields.name_of_suspected) recordName = updateFields.name_of_suspected;
    if (updateFields.customer_name) recordName = updateFields.customer_name;
    if (updateFields.nameeng) recordName = updateFields.nameeng;

    const result = await pool.query(
      `UPDATE ${config.table} SET ${setClause} WHERE ${config.pk} = $${values.length}`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    // Insert Audit Log
    const userId = req.user?.id || null;
    const username = req.user?.username || "Unknown";
    const auditDetails = {
      updated_fields: updateFields,
      record_name: recordName
    };

    await pool.query(
      `INSERT INTO audit_logs (user_id, username, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, username, "UPDATE", config.table, id, JSON.stringify(auditDetails)]
    );

    res.json({ success: true, message: "Record updated successfully" });
  } catch (err) {
    console.error(`PUT /api/list/local/${type}/${id} error:`, err);
    res.status(500).json({ success: false, message: `Failed to update ${type} record` });
  }
});

// =========================================================
// DELETE /api/list/local/:type/:id
// =========================================================
router.delete("/:type/:id", userAuth, async (req, res) => {
  const { type, id } = req.params;
  const config = listConfig[type];

  if (!config) {
    return res.status(400).json({ success: false, message: "Invalid list type" });
  }

  try {
    const pool = getDLPool();

    // Fetch existing record to get its name
    const existingResult = await pool.query(`SELECT * FROM ${config.table} WHERE ${config.pk} = $1`, [id]);
    if (existingResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    const existingRecord = existingResult.rows[0];
    const recordName = existingRecord.name || existingRecord.name_of_suspected || existingRecord.customer_name || existingRecord.nameeng || "Unknown";

    const result = await pool.query(
      `DELETE FROM ${config.table} WHERE ${config.pk} = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    // Insert Audit Log
    const userId = req.user?.id || null;
    const username = req.user?.username || "Unknown";
    const auditDetails = {
      deleted: true,
      record_name: recordName
    };

    await pool.query(
      `INSERT INTO audit_logs (user_id, username, action, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, username, "DELETE", config.table, id, JSON.stringify(auditDetails)]
    );

    res.json({ success: true, message: "Record deleted successfully" });
  } catch (err) {
    console.error(`DELETE /api/list/local/${type}/${id} error:`, err);
    res.status(500).json({ success: false, message: `Failed to delete ${type} record` });
  }
});

module.exports = router;
