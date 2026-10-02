const express = require("express");
const router = express.Router();
const multer = require("multer");
const sax = require("sax");
const fs = require("fs");
const path = require("path");
const { getDLPool } = require("../config/db");
const userAuth = require("../middleware/userAuth");

router.use(userAuth);
const TABLE = "ofac_sanctions_list";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure uploads folder exists
        if (!fs.existsSync("uploads")) {
            fs.mkdirSync("uploads");
        }
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, `ofac-${Date.now()}.xml`);
    },
});
const upload = multer({ storage });

router.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    console.log("Started parsing OFAC XML...");
    const pool = getDLPool();
    const client = await pool.connect();
    let insertedCount = 0;

    try {
        await client.query("BEGIN");
        // Clear out the existing table to load fresh data
        await client.query(`TRUNCATE TABLE ${TABLE} RESTART IDENTITY`);

        let rowsToInsert = [];

        // In-memory maps to replace the need for separate DB lookup tables
        const featureTypeMap = {}; // Maps featureTypeId -> "Birthdate", "Place of Birth", etc.
        const refMap = {};         // Maps refId -> text value (from referenceValues)

        await new Promise((resolve, reject) => {
            const stream = fs.createReadStream(req.file.path, { encoding: "utf8" });
            const parser = sax.createStream(true, { trim: true, normalize: true });

            // State variables
            let currentTag = "";
            let currentText = "";

            // For referenceValue & featureType Lookups
            let inRefValue = false;
            let inFeatureType = false;
            let tempRefId = null;
            let tempFeatureTypeId = null;

            // For actual Entities
            let inEntity = false;
            let currentEntity = null;

            let inName = false;
            let currentName = null;

            let inFeature = false;
            let currentFeature = null;

            parser.on("opentag", (node) => {
                currentTag = node.name;
                currentText = "";

                if (node.name === "referenceValue") {
                    inRefValue = true;
                    tempRefId = node.attributes.refId;
                } else if (node.name === "featureType") {
                    inFeatureType = true;
                    tempFeatureTypeId = node.attributes.featureTypeId || node.attributes.id;
                } else if (node.name === "entity") {
                    inEntity = true;
                    currentEntity = {
                        ofac_id: node.attributes.id,
                        identity_id: null,
                        entity_type: null,
                        primary_name: null,
                        aliases: [],
                        dob: null,
                        pob: null,
                        citizenship: null,
                        addresses: [],
                        features: [],
                        sanctions_lists: [],
                        sanctions_programs: []
                    };
                } else if (inEntity) {
                    if (node.name === "name") {
                        inName = true;
                        currentName = { isPrimary: false, fullName: "" };
                    } else if (node.name === "feature") {
                        inFeature = true;
                        currentFeature = { typeId: null, value: null, date: null };
                    } else if (node.name === "type" && inFeature) {
                        // <type featureTypeId="8"/>
                        currentFeature.typeId = node.attributes.featureTypeId;
                    }
                }
            });

            parser.on("text", (text) => {
                if (text.trim()) {
                    currentText += text.trim() + " ";
                }
            });

            parser.on("closetag", async (tagName) => {
                currentText = currentText.trim();

                if (tagName === "referenceValue") {
                    inRefValue = false;
                } else if (tagName === "featureType") {
                    inFeatureType = false;
                } else if (tagName === "value" && inRefValue && tempRefId) {
                    refMap[tempRefId] = currentText;
                } else if (tagName === "type" && inFeatureType && tempFeatureTypeId) {
                    featureTypeMap[tempFeatureTypeId] = currentText;
                } else if (tagName === "entity") {
                    // Entity is fully parsed, flush to array
                    rowsToInsert.push([
                        currentEntity.ofac_id,
                        currentEntity.identity_id,
                        currentEntity.entity_type,
                        currentEntity.primary_name || "Unknown",
                        null, // first_name (can parse later if needed)
                        null, // last_name
                        JSON.stringify(currentEntity.aliases),
                        currentEntity.dob,
                        currentEntity.pob,
                        currentEntity.citizenship,
                        JSON.stringify(currentEntity.addresses),
                        JSON.stringify(currentEntity.features),
                        JSON.stringify(currentEntity.sanctions_lists),
                        JSON.stringify(currentEntity.sanctions_programs)
                    ]);
                    inEntity = false;

                    // If we reach 500 rows, flush to DB memory to prevent heap crash
                    if (rowsToInsert.length >= 500) {
                        const batch = rowsToInsert;
                        rowsToInsert = [];
                        await insertBatch(client, batch);
                        insertedCount += batch.length;
                    }

                } else if (inEntity) {
                    if (tagName === "identityId") {
                        currentEntity.identity_id = currentText;
                    } else if (tagName === "entityType") {
                        currentEntity.entity_type = currentText;
                    } else if (tagName === "name") {
                        if (currentName.isPrimary) {
                            currentEntity.primary_name = currentName.fullName;
                        } else {
                            if (currentName.fullName) {
                                currentEntity.aliases.push(currentName.fullName);
                            }
                        }
                        inName = false;
                    } else if (tagName === "isPrimary" && inName) {
                        currentName.isPrimary = (currentText.toLowerCase() === "true");
                    } else if (tagName === "formattedFullName" && inName) {
                        currentName.fullName = currentText;
                    } else if (tagName === "feature") {
                        // Check the lookup map we created!
                        const typeName = featureTypeMap[currentFeature.typeId] || "Unknown Feature";

                        if (typeName.toLowerCase().includes("birthdate") && currentFeature.date) {
                            currentEntity.dob = currentFeature.date;
                        } else if (typeName.toLowerCase().includes("place of birth") && currentFeature.value) {
                            currentEntity.pob = currentFeature.value;
                        } else if (typeName.toLowerCase().includes("citizenship") && currentFeature.value) {
                            currentEntity.citizenship = currentFeature.value;
                        } else {
                            currentEntity.features.push({ type: typeName, value: currentFeature.value, date: currentFeature.date });
                        }
                        inFeature = false;
                    } else if (tagName === "value" && inFeature) {
                        currentFeature.value = currentText;
                    } else if (tagName === "fromDateBegin" && inFeature) {
                        currentFeature.date = currentText;
                    } else if (tagName === "sanctionsList") {
                        if (currentText) {
                            currentEntity.sanctions_lists.push(currentText);
                        }
                    } else if (tagName === "sanctionsProgram") {
                        if (currentText) {
                            currentEntity.sanctions_programs.push(currentText);
                        }
                    }
                }

                currentTag = "";
                currentText = "";
            });

            parser.on("end", async () => {
                // Insert remaining rows
                if (rowsToInsert.length > 0) {
                    await insertBatch(client, rowsToInsert);
                    insertedCount += rowsToInsert.length;
                }
                resolve();
            });

            parser.on("error", (err) => {
                reject(err);
            });

            // Use chunk writing for stream stability
            stream.on("data", (chunk) => parser.write(chunk));
            stream.on("end", () => parser.end());
        });

        if (insertedCount === 0) {
            throw new Error("Invalid XML format or no valid records found. Table was not updated.");
        }
        await client.query("COMMIT");
        console.log(`Successfully parsed and inserted ${insertedCount} OFAC entities.`);
        res.json({ success: true, message: `OFAC XML uploaded and parsed successfully (${insertedCount} records)` });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("OFAC Upload Error:", error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});

// Helper function to insert array of rows
async function insertBatch(client, rows) {
    for (const row of rows) {
        await client.query(`
        INSERT INTO ofac_sanctions_list (
          ofac_id, identity_id, entity_type, primary_name, first_name, last_name,
          aliases, dob, pob, citizenship, addresses, features, sanctions_lists, sanctions_programs
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (ofac_id) DO UPDATE SET
          identity_id = EXCLUDED.identity_id,
          entity_type = EXCLUDED.entity_type,
          primary_name = EXCLUDED.primary_name,
          aliases = EXCLUDED.aliases,
          dob = EXCLUDED.dob,
          pob = EXCLUDED.pob,
          citizenship = EXCLUDED.citizenship,
          addresses = EXCLUDED.addresses,
          features = EXCLUDED.features,
          sanctions_lists = EXCLUDED.sanctions_lists,
          sanctions_programs = EXCLUDED.sanctions_programs
      `, row);
    }
}

// Add the basic list and search routes below so the frontend can query it
router.get("/", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = parseInt(req.query.offset, 10) || 0;

        const pool = getDLPool();
        const { rows } = await pool.query(
            `SELECT * FROM ${TABLE} ORDER BY id ASC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("GET /api/list/ofac error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch OFAC list" });
    }
});

module.exports = router;
