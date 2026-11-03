const { Pool } = require("pg");
require("dotenv").config();

/**
 * Configure PostgreSQL connection pool.
 * Supports:
 * - DATABASE_URL (Render standard external/internal connection string)
 * - DATABASE_INTERNAL_URL (Render internal private networking)
 * - Individual DB_* env variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 * - Automatic SSL handling for cloud hosts (Render, Supabase, Neon, AWS RDS)
 * - Auto-disabling SSL for local dev (localhost / 127.0.0.1) unless DB_SSL=true
 * - Removal of template brackets around password if accidentally present
 */
function createPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_INTERNAL_URL;

  let config = {};

  if (databaseUrl && typeof databaseUrl === "string" && databaseUrl.trim()) {
    // Sanitize any accidentally copied bracket syntax: postgres://user:[pass]@host/db -> postgres://user:pass@host/db
    const sanitizedUrl = databaseUrl.trim().replace(/(:\/\/[^:]+:)(?:%5B|\[)(.+?)(?:%5D|\])(@)/, "$1$2$3");
    config.connectionString = sanitizedUrl;
  } else {
    config = {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "postgres",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
    };
  }

  // Determine SSL configuration
  const explicitSsl = process.env.DB_SSL;
  let useSsl = false;

  if (explicitSsl === "true" || explicitSsl === "1") {
    useSsl = true;
  } else if (explicitSsl === "false" || explicitSsl === "0" || process.env.NODE_ENV === "test") {
    useSsl = false;
  } else {
    // Auto-detect: if connecting to remote host, enable SSL with rejectUnauthorized: false
    const target = (config.connectionString || config.host || "").toLowerCase();
    const isLocal = target.includes("localhost") || target.includes("127.0.0.1");
    useSsl = !isLocal;
  }

  config.ssl = useSsl ? { rejectUnauthorized: false } : false;
  config.connectionTimeoutMillis = Number(process.env.DB_CONNECTION_TIMEOUT || 15000);
  config.idleTimeoutMillis = Number(process.env.DB_IDLE_TIMEOUT || 30000);
  config.max = Number(process.env.DB_POOL_MAX || 10);
  config.keepAlive = true;

  return config;
}

const pool = new Pool(createPoolConfig());

pool.on("error", (error) => {
  console.error("Unexpected idle PostgreSQL client error:", {
    message: error.message,
    code: error.code,
  });
});

module.exports = pool;
