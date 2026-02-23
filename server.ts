import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { neon } from '@neondatabase/serverless';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const dbPath = process.env.VERCEL ? "/tmp/miam_miam.db" : (process.env.DATABASE_PATH || "miam_miam.db");
let db: any;
let pgSql: any;

if (process.env.POSTGRES_URL) {
  pgSql = neon(process.env.POSTGRES_URL);
}

async function initPostgres() {
  if (!pgSql) return;
  
  await pgSql(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      pseudo TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      phone TEXT,
      image_data TEXT,
      password TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgSql(`
    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      exchange_category TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      is_all_year BOOLEAN DEFAULT FALSE,
      image_data TEXT,
      status TEXT DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      ad_id INTEGER NOT NULL REFERENCES ads(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgSql(`
    CREATE TABLE IF NOT EXISTS gallery (
      id SERIAL PRIMARY KEY,
      image_data TEXT NOT NULL,
      caption TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

if (!process.env.POSTGRES_URL) {
  console.log(`Using SQLite database at: ${dbPath}`);
  db = new Database(dbPath);
  
  // Initialize SQLite Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pseudo TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      phone TEXT,
      image_data TEXT,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      exchange_category TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      is_all_year BOOLEAN DEFAULT 0,
      image_data TEXT,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ad_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ad_id) REFERENCES ads(id),
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      day_of_week INTEGER,
      start_hour TEXT,
      end_hour TEXT,
      months TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_data TEXT NOT NULL,
      caption TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add columns if missing
  try { db.prepare("ALTER TABLE users ADD COLUMN image_data TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE ads ADD COLUMN image_data TEXT").run(); } catch (e) {}
  try { db.prepare("ALTER TABLE ads ADD COLUMN status TEXT DEFAULT 'open'").run(); } catch (e) {}
} else {
  console.log("Using Postgres database.");
  initPostgres().catch(console.error);
}

// Database helpers to support both SQLite and Postgres
async function dbQuery(text: string, params: any[] = []) {
  if (process.env.POSTGRES_URL) {
    let i = 0;
    const pgQuery = text.replace(/\?/g, () => `$${++i}`);
    return await pgSql(pgQuery, params);
  } else {
    return db.prepare(text).all(...params);
  }
}

async function dbGet(text: string, params: any[] = []) {
  if (process.env.POSTGRES_URL) {
    let i = 0;
    const pgQuery = text.replace(/\?/g, () => `$${++i}`);
    const rows = await pgSql(pgQuery, params);
    return rows[0];
  } else {
    return db.prepare(text).get(...params);
  }
}

async function dbRun(text: string, params: any[] = []) {
  if (process.env.POSTGRES_URL) {
    let i = 0;
    const pgQuery = text.replace(/\?/g, () => `$${++i}`);
    const isInsert = text.trim().toUpperCase().startsWith("INSERT");
    const finalQuery = isInsert ? `${pgQuery} RETURNING id` : pgQuery;
    const rows = await pgSql(finalQuery, params);
    return { lastInsertRowid: (rows[0] as any)?.id };
  } else {
    const info = db.prepare(text).run(...params);
    return { lastInsertRowid: info.lastInsertRowid };
  }
}

async function startServer() {
  const PORT = parseInt(process.env.PORT || "3000", 10);

  console.log(`Starting server on port ${PORT}...`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });

  app.use(express.json({ limit: '5mb' }));

  // Health check for Cloud Run
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // API Routes
  app.post("/api/register", async (req, res) => {
    const { name, pseudo, address, city, phone, image_data, password } = req.body;
    try {
      const info = await dbRun("INSERT INTO users (name, pseudo, address, city, phone, image_data, password) VALUES (?, ?, ?, ?, ?, ?, ?)", [name, pseudo, address, city, phone, image_data, password]);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { pseudo, password } = req.body;
    const user = await dbGet("SELECT * FROM users WHERE pseudo = ? AND password = ?", [pseudo, password]);
    if (user) res.json(user);
    else res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });
  });

  app.post("/api/ads", async (req, res) => {
    const { user_id, type, category, title, description, exchange_category, start_date, end_date, is_all_year, image_data } = req.body;
    try {
      const info = await dbRun(`
        INSERT INTO ads (user_id, type, category, title, description, exchange_category, start_date, end_date, is_all_year, image_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [user_id, type, category, title, description, exchange_category, start_date, end_date, is_all_year ? 1 : 0, image_data]);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/ads", async (req, res) => {
    const { category, city, date } = req.query;
    let query = `
      SELECT ads.*, users.pseudo, users.city as user_city, users.image_data as user_image
      FROM ads 
      JOIN users ON ads.user_id = users.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (category) {
      conditions.push("ads.category = ?");
      params.push(category);
    }
    if (city) {
      conditions.push("users.city LIKE ?");
      params.push(`%${city}%`);
    }
    if (date) {
      conditions.push("(ads.is_all_year = 1 OR (? BETWEEN ads.start_date AND ads.end_date))");
      params.push(date);
    }

    conditions.push("ads.status = 'open'");

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY ads.created_at DESC";

    const ads = await dbQuery(query, params);
    res.json(ads);
  });

  app.get("/api/gallery", async (req, res) => {
    const images = await dbQuery("SELECT * FROM gallery ORDER BY created_at DESC");
    res.json(images);
  });

  app.post("/api/gallery", async (req, res) => {
    const { image_data, caption } = req.body;
    try {
      const info = await dbRun("INSERT INTO gallery (image_data, caption) VALUES (?, ?)", [image_data, caption]);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Messaging Routes
  app.post("/api/messages", async (req, res) => {
    const { ad_id, sender_id, receiver_id, content, type } = req.body;
    try {
      const info = await dbRun(`
        INSERT INTO messages (ad_id, sender_id, receiver_id, content, type)
        VALUES (?, ?, ?, ?, ?)
      `, [ad_id, sender_id, receiver_id, content, type || 'normal']);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/messages/ad/:adId", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const ad = await dbGet("SELECT user_id FROM ads WHERE id = ?", [req.params.adId]) as any;
    if (!ad) return res.status(404).json({ error: "Ad not found" });

    let query = `
      SELECT m.*, s.pseudo as sender_pseudo, r.pseudo as receiver_pseudo
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE m.ad_id = ?
    `;
    const params: any[] = [req.params.adId];

    // If not the ad owner, only see messages where user is sender or receiver
    if (Number(userId) !== ad.user_id) {
      query += " AND (m.sender_id = ? OR m.receiver_id = ?)";
      params.push(userId, userId);
    }

    query += " ORDER BY m.created_at ASC";
    
    const messages = await dbQuery(query, params);
    res.json(messages);
  });

  app.get("/api/messages/user/:userId", async (req, res) => {
    const messages = await dbQuery(`
      SELECT m.*, s.pseudo as sender_pseudo, r.pseudo as receiver_pseudo, a.title as ad_title
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      JOIN ads a ON m.ad_id = a.id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      ORDER BY m.created_at DESC
    `, [req.params.userId, req.params.userId]);
    res.json(messages);
  });

  app.patch("/api/ads/:id/status", async (req, res) => {
    const { status } = req.body;
    try {
      await dbRun("UPDATE ads SET status = ? WHERE id = ?", [status, req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Ne pas servir de fichiers statiques ici si on est sur Vercel (Vercel le fait nativement)
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is listening on 0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
