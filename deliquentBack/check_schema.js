const { getDLPool } = require("./config/db");
require("dotenv").config();

async function checkSchema() {
  const pool = getDLPool();
  try {
    const tables = ["black_list", "deliquent_list", "eth_list", "pep_list", "pep_adverser_list"];
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(`\nTable: ${table}`);
      res.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}

checkSchema();
