import { Pool } from 'pg';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  const postgresUrl = process.env.POSTGRES_URL;

  if (postgresUrl) {
    console.log('--- Testing PostgreSQL Connection ---');
    console.log('URL found, attempting connection...');
    
    const pool = new Pool({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false }
    });

    try {
      const start = Date.now();
      const res = await pool.query('SELECT NOW() as now, version() as version');
      const duration = Date.now() - start;
      
      console.log('✅ SUCCESS: Connected to PostgreSQL');
      console.log('Server Time:', res.rows[0].now);
      console.log('Version:', res.rows[0].version.split(',')[0]);
      console.log(`Response time: ${duration}ms`);
      
      // Check tables
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log('Existing tables:', tables.rows.map(t => t.table_name).join(', ') || 'None');
      
    } catch (err: any) {
      console.error('❌ ERROR: Failed to connect to PostgreSQL');
      console.error('Message:', err.message);
      if (err.code) console.error('Code:', err.code);
    } finally {
      await pool.end();
    }
  } else {
    console.log('--- Testing SQLite Connection ---');
    try {
      const db = new Database('twokaj.db');
      const row = db.prepare("SELECT date('now') as now").get() as any;
      console.log('✅ SUCCESS: Connected to SQLite');
      console.log('Local DB Date:', row.now);
      
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      console.log('Existing tables:', tables.map(t => t.name).join(', ') || 'None');
    } catch (err: any) {
      console.error('❌ ERROR: Failed to connect to SQLite');
      console.error('Message:', err.message);
    }
  }
}

testConnection();
