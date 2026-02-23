import { Pool } from "pg";

let pool: Pool | null = null;

export async function getPostgresPool() {
  if (!pool) {
    const connectionString = process.env.PROD_POSTGRES_URL || 
                             process.env.POSTGRES_URL || 
                             process.env.PROD_DATABASE_URL || 
                             process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("No PostgreSQL connection string found in environment variables (checked PROD_POSTGRES_URL, POSTGRES_URL, etc.)");
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    // Test connection
    try {
      await pool.query('SELECT 1');
      console.log("PostgreSQL Connected");
    } catch (err) {
      console.error("PostgreSQL Connection Error:", err);
      throw err;
    }
  }
  return pool;
}

export async function pgQuery(text: string, params: any[] = []) {
  const p = await getPostgresPool();
  const res = await p.query(text, params);
  return res.rows;
}

export async function initPostgresTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      pseudo TEXT UNIQUE,
      address TEXT,
      phone TEXT,
      email TEXT UNIQUE,
      password TEXT,
      categories TEXT,
      profile_photo TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT,
      category TEXT,
      title TEXT,
      description TEXT,
      location TEXT,
      start_date TEXT,
      end_date TEXT,
      availability TEXT,
      photo TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      ad_id TEXT,
      sender_id TEXT,
      receiver_id TEXT,
      content TEXT,
      type TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS gallery (
      id TEXT PRIMARY KEY,
      photo_url TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  for (const q of queries) {
    await pgQuery(q);
  }
  console.log("PostgreSQL Tables Initialized");
}
