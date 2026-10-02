const crypto = require("crypto");
const { getDLPool } = require("../config/db");

const INACTIVITY_MS = 15 * 60 * 1000;

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* =========================
   CREATE SESSION
========================= */

async function createSession(
  userId,
  deviceId,
  ipAddress,
  userAgent
) {
  const pool = getDLPool();
  const sessionToken = createSessionToken();

  // Deactivate previous sessions
  // Single-session login
  await pool.query(
    `
    UPDATE sessions
    SET is_active = false,
        last_logout_at = NOW()
    WHERE user_id = $1
      AND is_active = true
    `,
    [userId]
  );

  // Create new session
  const result = await pool.query(
    `
    INSERT INTO sessions (
      user_id,
      session_token,
      device_id,
      ip_address,
      user_agent,
      last_activity,
      last_login_at,
      expires_at,
      is_active
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      NOW(),
      NOW(),
      NOW() + INTERVAL '1 day',
      true
    )
    RETURNING *
    `,
    [
      userId,
      sessionToken,
      deviceId || "unknown",
      ipAddress || "unknown",
      userAgent || "unknown",
    ]
  );

  return {
    session: result.rows[0],
    sessionToken,
  };
}

/* =========================
   VALIDATE SESSION
========================= */

async function validateSession(
  userId,
  sessionToken,
  deviceId
) {
  const pool = getDLPool();

  const result = await pool.query(
    `
    SELECT *
    FROM sessions
    WHERE user_id = $1
      AND is_active = true
    ORDER BY last_activity DESC
    LIMIT 1
    `,
    [userId]
  );

  const session = result.rows[0];

  if (!session) {
    return {
      valid: false,
      msg: "Session expired. Please login again.",
    };
  }

  // Check session token
  if (session.session_token !== sessionToken) {
    return {
      valid: false,
      msg: "Logged in on another device.",
    };
  }

  // Check device
  if (
    deviceId &&
    session.device_id !== deviceId
  ) {
    return {
      valid: false,
      msg: "Device mismatch.",
    };
  }

  // Check absolute expiration
  if (
    session.expires_at &&
    new Date(session.expires_at).getTime() < Date.now()
  ) {
    await pool.query(
      `
      UPDATE sessions
      SET is_active = false,
          last_logout_at = NOW()
      WHERE id = $1
      `,
      [session.id]
    );

    return {
      valid: false,
      msg: "Session expired. Please login again.",
    };
  }

  // Check inactivity
  const inactiveMs =
    Date.now() -
    new Date(session.last_activity).getTime();

  if (inactiveMs > INACTIVITY_MS) {
    await pool.query(
      `
      UPDATE sessions
      SET is_active = false,
          last_logout_at = NOW()
      WHERE id = $1
      `,
      [session.id]
    );

    return {
      valid: false,
      msg: "Session expired due to inactivity.",
    };
  }

  // Update activity
  await pool.query(
    `
    UPDATE sessions
    SET last_activity = NOW()
    WHERE id = $1
    `,
    [session.id]
  );

  return {
    valid: true,
    session,
  };
}

/* =========================
   INVALIDATE SESSION
========================= */

async function invalidateSession(userId) {
  const pool = getDLPool();

  await pool.query(
    `
    UPDATE sessions
    SET is_active = false,
        last_logout_at = NOW()
    WHERE user_id = $1
      AND is_active = true
    `,
    [userId]
  );
}

module.exports = {
  INACTIVITY_MS,
  createSession,
  validateSession,
  invalidateSession,
};