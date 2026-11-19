import pg from "pg";
import { config } from "../config.js";

// Render's internal connection string works without SSL; set DATABASE_SSL=true
// when connecting through an external URL (e.g. from your laptop to Render Postgres).
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});
