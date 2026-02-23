import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { pgQuery, initPostgresTables } from "./src/db-postgres";

dotenv.config();

const app = express();
const PORT = 3000;
const isPostgres = !!process.env.POSTGRES_URL;

app.use(express.json({ limit: '10mb' }));

// Lazy DB Init
let dbInitialized = false;
async function ensureDb() {
  if (dbInitialized) return;
  if (isPostgres) {
    await initPostgresTables();
  } else {
    // SQLite logic only for local dev
    try {
      const Database = (await import("better-sqlite3")).default;
      const db = new Database("twokaj.db");
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, pseudo TEXT UNIQUE, address TEXT, phone TEXT, email TEXT UNIQUE, password TEXT, categories TEXT, profile_photo TEXT, is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS ads (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, category TEXT, title TEXT, description TEXT, location TEXT, start_date TEXT, end_date TEXT, availability TEXT, photo TEXT, status TEXT DEFAULT 'open', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, ad_id TEXT, sender_id TEXT, receiver_id TEXT, content TEXT, type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS gallery (id TEXT PRIMARY KEY, photo_url TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      `);
      (global as any).sqliteDb = db;
    } catch (e) {
      console.error("SQLite failed", e);
    }
  }
  dbInitialized = true;
}

const query = async (text: string, params: any[] = []) => {
  await ensureDb();
  if (isPostgres) {
    return pgQuery(text, params);
  } else {
    const db = (global as any).sqliteDb;
    const processedText = text.replace(/\$\d+/g, '?');
    const stmt = db.prepare(processedText);
    return processedText.trim().toUpperCase().startsWith("SELECT") ? stmt.all(...params) : stmt.run(...params);
  }
};

// API Routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { id, name, pseudo, address, phone, email, password, categories, profile_photo } = req.body;
    await query(`INSERT INTO users (id, name, pseudo, address, phone, email, password, categories, profile_photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, 
      [id, name, pseudo, address, phone, email, password, JSON.stringify(categories || []), profile_photo || '']);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const rows = await query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
    if (rows[0]) {
      rows[0].categories = JSON.parse(rows[0].categories || '[]');
      res.json(rows[0]);
    } else res.status(401).json({ error: "Invalid credentials" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get("/api/ads", async (req, res) => {
  try {
    const ads = await query("SELECT ads.*, users.pseudo FROM ads JOIN users ON ads.user_id = users.id WHERE ads.status = 'open' ORDER BY ads.created_at DESC");
    res.json(ads.map((ad: any) => ({ ...ad, availability: JSON.parse(ad.availability || '{}') })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/ads", async (req, res) => {
  try {
    const { id, user_id, type, category, title, description, location, start_date, end_date, availability, photo } = req.body;
    await query(`INSERT INTO ads (id, user_id, type, category, title, description, location, start_date, end_date, availability, photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, 
      [id, user_id, type, category, title, description, location, start_date, end_date, JSON.stringify(availability), photo]);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.get("/api/messages/:userId", async (req, res) => {
  try {
    const messages = await query("SELECT messages.*, users.pseudo as sender_pseudo FROM messages JOIN users ON messages.sender_id = users.id WHERE receiver_id = $1 OR sender_id = $2 ORDER BY created_at ASC", [req.params.userId, req.params.userId]);
    res.json(messages);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/messages", async (req, res) => {
  try {
    const { id, ad_id, sender_id, receiver_id, content, type } = req.body;
    await query(`INSERT INTO messages (id, ad_id, sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4, $5, $6)`, [id, ad_id, sender_id, receiver_id, content, type]);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.get("/api/gallery", async (req, res) => {
  try {
    const items = await query("SELECT * FROM gallery ORDER BY created_at DESC");
    res.json(items);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post("/api/gallery", async (req, res) => {
  try {
    const { id, photo_url, description } = req.body;
    await query("INSERT INTO gallery (id, photo_url, description) VALUES ($1, $2, $3)", [id, photo_url, description]);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// Vite / Static
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
  app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
}

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => console.log(`Server on ${PORT}`));
}

export default app;
