require("dotenv").config();

const { Pool } = require("pg");

const libDLPool = new Pool({
  connectionString: process.env.DLIST_DB_URL,
});

const connectDB = async () => {
  try {
    const result = await libDLPool.query("SELECT NOW()");
    console.log(
      "Connected to DLIST_DB:",
      result.rows[0].now.toString()
    );
  } catch (err) {
    console.error("DLIST DB ERROR:", err.message);
    setTimeout(connectDB, 5000);
  }
};
module.exports = {
  connectDB,
  getDLPool: () => libDLPool,
};