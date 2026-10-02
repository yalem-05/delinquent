require("dotenv").config();

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const { getDLPool } = require("./db");

const DATABASE_NAME = "deliquent";

async function createDatabaseIfNotExists() {
  console.log("🔄 Checking PostgreSQL database...");

  if (!process.env.DLIST_DB_URL) {
    throw new Error(" DLIST_DB_URL is not defined in .env");
  }

  const adminConnectionString = process.env.DLIST_DB_URL.replace(
    /\/deliquent(\?.*)?$/,
    "/postgres$1"
  );

  const adminPool = new Pool({
    connectionString: adminConnectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  let client;

  try {
    client = await adminPool.connect();

    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DATABASE_NAME]
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${DATABASE_NAME}"`);
      console.log(`✅ Database "${DATABASE_NAME}" created`);
    } else {
      console.log(`✅ Database "${DATABASE_NAME}" already exists`);
    }
  } catch (err) {
    console.error("❌ Database creation/check failed:", err.message);
    throw err;
  } finally {
    if (client) client.release();
    await adminPool.end();
  }
}

async function init() {
  await createDatabaseIfNotExists();

  const pool = getDLPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // =====================================================
    // USERS
    // =====================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,

        username VARCHAR(100) UNIQUE NOT NULL,

        name VARCHAR(200) NOT NULL,

        password TEXT NOT NULL,

        role VARCHAR(20) NOT NULL
          CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),

        enabled BOOLEAN DEFAULT TRUE,

        created_by INT
          REFERENCES users(id),

        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // =====================================================
    // SESSIONS
    // =====================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,

        user_id INT NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        session_token TEXT UNIQUE NOT NULL,

        device_id TEXT,

        ip_address TEXT,

        user_agent TEXT,

        last_activity TIMESTAMP NOT NULL DEFAULT NOW(),

        last_login_at TIMESTAMP NOT NULL DEFAULT NOW(),

        last_logout_at TIMESTAMP,

        expires_at TIMESTAMP NOT NULL,

        is_active BOOLEAN NOT NULL DEFAULT TRUE,

        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
    CREATE TABLE IF NOT EXISTS international_pep (
        id VARCHAR PRIMARY KEY,
        schema VARCHAR,
        name VARCHAR,
        aliases VARCHAR,
        birth_date VARCHAR,
        countries VARCHAR,
        addresses VARCHAR,
        identifiers VARCHAR,
        sanctions VARCHAR,
        phones VARCHAR,
        emails VARCHAR,
        program_id VARCHAR,
        dataset VARCHAR,
        first_seen TIMESTAMP,
        last_seen TIMESTAMP,
        last_change TIMESTAMP
      )
    `);

    await client.query(`
    CREATE TABLE IF NOT EXISTS uk_sanctions_list (
        unique_id VARCHAR PRIMARY KEY,
        last_updated VARCHAR,
        date_designated VARCHAR,
        ofsi_group_id VARCHAR,
        un_reference_number VARCHAR,
        names VARCHAR,
        non_latin_names VARCHAR,
        regime_name VARCHAR,
        individual_entity_ship VARCHAR,
        designation_source VARCHAR,
        sanctions_imposed VARCHAR,
        sanctions_imposed_indicators VARCHAR,
        other_information VARCHAR,
        uk_statement_of_reasons VARCHAR,
        addresses VARCHAR,
        phone_numbers VARCHAR,
        email_addresses VARCHAR
    )
    `);

    // =====================================================
    // AUDIT LOGS
    // =====================================================

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(100),
        action VARCHAR(50) NOT NULL,
        table_name VARCHAR(100) NOT NULL,
        record_id VARCHAR(255) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);


    // =====================================================
    // SESSION INDEXES
    // =====================================================

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id
      ON sessions(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token
      ON sessions(session_token)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_active
      ON sessions(user_id, is_active)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_device
      ON sessions(user_id, device_id)
    `);

    // =====================================================
    // DEFAULT SUPER ADMIN
    // =====================================================

    const passwordHash = await bcrypt.hash("12345678", 10);

    await client.query(
      `
      INSERT INTO users (
        username,
        name,
        password,
        role,
        enabled,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username)
      DO NOTHING
      `,
      [
        "anbesa",
        "Mulugeta Haile",
        passwordHash,
        "SUPER_ADMIN",
        true,
        null,
      ]
    );

    await client.query("COMMIT");

    console.log("✅ Database initialization completed");
    console.log("👤 Default user: anbesa");
    console.log("🔐 Role: SUPER_ADMIN");
  } catch (err) {
    await client.query("ROLLBACK");

    console.error(
      "❌ Database initialization failed:",
      err.message
    );

    throw err;
  } finally {
    client.release();
  }
}

module.exports = init;