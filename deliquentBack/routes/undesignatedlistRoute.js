const express = require("express");
const router = express.Router();
const multer = require("multer");
const sax = require("sax");
const fs = require("fs");
const path = require("path");
const { getDLPool } = require("../config/db");
const userAuth = require("../middleware/userAuth");

router.use(userAuth);
const TABLE = "un_designated_list";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads");
    }
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `undesignated-${Date.now()}.xml`);
  },
});
const upload = multer({ storage });

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  console.log("Started parsing UN Designated XML...");
  const pool = getDLPool();
  const client = await pool.connect();
  let insertedCount = 0;

  try {
    await client.query("BEGIN");
    // Clear out the existing table to load fresh data
    await client.query(`TRUNCATE TABLE ${TABLE} RESTART IDENTITY`);

    let rowsToInsert = [];

    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(req.file.path, { encoding: "utf8" });
      const parser = sax.createStream(true, { trim: true, normalize: true });

      let stack = [];
      let currentText = "";

      parser.on("opentag", (node) => {
        if (node.name === "INDIVIDUAL" || node.name === "ENTITY") {
          stack = [{ _name: node.name }];
        } else if (stack.length > 0) {
          stack.push({ _name: node.name });
        }
        currentText = "";
      });

      parser.on("text", (text) => {
        if (stack.length > 0) {
          currentText += text;
        }
      });

      parser.on("closetag", async (tagName) => {
        if (stack.length > 0) {
          const obj = stack.pop();
          if (Object.keys(obj).length === 1 && currentText.trim()) {
            obj.value = currentText.trim();
          }
          delete obj._name;
          currentText = "";

          if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            if (!parent[tagName]) {
              parent[tagName] = obj;
            } else {
              if (!Array.isArray(parent[tagName])) {
                parent[tagName] = [parent[tagName]];
              }
              parent[tagName].push(obj);
            }
          } else {
            // We popped the root item (INDIVIDUAL or ENTITY)
            const dataid = obj.DATAID?.value || null;
            const versionnum = obj.VERSIONNUM?.value || null;
            const first_name = obj.FIRST_NAME?.value || null;
            const second_name = obj.SECOND_NAME?.value || null;
            const third_name = obj.THIRD_NAME?.value || null;
            const un_list_type = obj.UN_LIST_TYPE?.value || null;
            const reference_number = obj.REFERENCE_NUMBER?.value || null;
            const listed_on = obj.LISTED_ON?.value || null;
            const gender = obj.GENDER?.value || null;
            const comments1 = obj.COMMENTS1?.value || null;

            // Helper to safely extract <VALUE> elements (which can be arrays or single objects)
            const extractValues = (field) => {
              if (!field) return null;
              if (field.VALUE) {
                if (Array.isArray(field.VALUE)) {
                  return field.VALUE.map(v => v.value).filter(Boolean).join(', ');
                }
                return field.VALUE.value || null;
              }
              return field.value || null;
            };

            const designation = extractValues(obj.DESIGNATION);
            const nationality = extractValues(obj.NATIONALITY);
            const list_type = extractValues(obj.LIST_TYPE);
            const last_day_updated = extractValues(obj.LAST_DAY_UPDATED);
            const has_interpol_link = obj.HAS_INTERPOL_LINK?.value || null;
            const interpol_link = obj.INTERPOL_LINK?.value || null;

            // Helper to ensure nested items are returned as flat JSON arrays
            const forceArray = (item) => {
              if (!item) return [];
              return Array.isArray(item) ? item : [item];
            };

            const aliases = forceArray(obj.INDIVIDUAL_ALIAS || obj.ENTITY_ALIAS);
            const addresses = forceArray(obj.INDIVIDUAL_ADDRESS || obj.ENTITY_ADDRESS);
            const dob = forceArray(obj.INDIVIDUAL_DATE_OF_BIRTH);
            const pob = forceArray(obj.INDIVIDUAL_PLACE_OF_BIRTH);
            const documents = forceArray(obj.INDIVIDUAL_DOCUMENT);

            rowsToInsert.push([
              dataid, versionnum, first_name, second_name, third_name,
              un_list_type, reference_number, listed_on, gender, comments1,
              designation, nationality, list_type, last_day_updated,
              JSON.stringify(aliases), JSON.stringify(addresses), JSON.stringify(dob), JSON.stringify(pob),
              JSON.stringify(documents), has_interpol_link, interpol_link
            ]);

            if (rowsToInsert.length >= 500) {
              const batch = rowsToInsert;
              rowsToInsert = [];
              await insertBatch(client, batch);
              insertedCount += batch.length;
            }
          }
        }
      });

      parser.on("end", async () => {
        if (rowsToInsert.length > 0) {
          await insertBatch(client, rowsToInsert);
          insertedCount += rowsToInsert.length;
        }
        resolve();
      });

      parser.on("error", (err) => {
        reject(err);
      });

      stream.on("data", (chunk) => parser.write(chunk));
      stream.on("end", () => parser.end());
    });

    if (insertedCount === 0) {
      throw new Error("Invalid XML format or no valid records found. Table was not updated.");
    }
    await client.query("COMMIT");
    console.log(`Successfully parsed and inserted ${insertedCount} UN entities.`);
    res.json({ success: true, message: `UN XML uploaded and parsed successfully (${insertedCount} records)` });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("UN Upload Error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

async function insertBatch(client, rows) {
  for (const row of rows) {
    await client.query(`
        INSERT INTO un_designated_list (
          dataid, versionnum, first_name, second_name, third_name,
          un_list_type, reference_number, listed_on, gender, comments1,
          designation, nationality, list_type, last_day_updated,
          aliases, addresses, dob, pob, documents, has_interpol_link, interpol_link
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (dataid) DO UPDATE SET
          versionnum = EXCLUDED.versionnum,
          first_name = EXCLUDED.first_name,
          second_name = EXCLUDED.second_name,
          third_name = EXCLUDED.third_name,
          un_list_type = EXCLUDED.un_list_type,
          reference_number = EXCLUDED.reference_number,
          listed_on = EXCLUDED.listed_on,
          gender = EXCLUDED.gender,
          comments1 = EXCLUDED.comments1,
          designation = EXCLUDED.designation,
          nationality = EXCLUDED.nationality,
          list_type = EXCLUDED.list_type,
          last_day_updated = EXCLUDED.last_day_updated,
          aliases = EXCLUDED.aliases,
          addresses = EXCLUDED.addresses,
          dob = EXCLUDED.dob,
          pob = EXCLUDED.pob,
          documents = EXCLUDED.documents,
          has_interpol_link = EXCLUDED.has_interpol_link,
          interpol_link = EXCLUDED.interpol_link
      `, row);
  }
}

router.get("/", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    const pool = getDLPool();
    const { rows } = await pool.query(`SELECT * FROM ${TABLE} ORDER BY id ASC LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error("GET /api/list/un error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch UN list" });
  }
});

module.exports = router;
