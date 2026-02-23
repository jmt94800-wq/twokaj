import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { sql } from '@vercel/postgres';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.VERCEL ? "/tmp/miam_miam.db" : (process.env.DATABASE_PATH || "miam_miam.db");
let db: any;

async function initPostgres() {
  await sql`
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
  `;

  await sql`
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
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      ad_id INTEGER NOT NULL REFERENCES ads(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT DEFAULT 'normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gallery (
      id SERIAL PRIMARY KEY,
      image_data TEXT NOT NULL,
      caption TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
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

async function startServer() {
  const app = express();
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
  app.post("/api/register", (req, res) => {
    const { name, pseudo, address, city, phone, image_data, password } = req.body;
    try {
      const info = db.prepare("INSERT INTO users (name, pseudo, address, city, phone, image_data, password) VALUES (?, ?, ?, ?, ?, ?, ?)").run(name, pseudo, address, city, phone, image_data, password);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/login", (req, res) => {
    const { pseudo, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE pseudo = ? AND password = ?").get(pseudo, password);
    if (user) res.json(user);
    else res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });
  });

  app.post("/api/ads", (req, res) => {
    const { user_id, type, category, title, description, exchange_category, start_date, end_date, is_all_year, image_data } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO ads (user_id, type, category, title, description, exchange_category, start_date, end_date, is_all_year, image_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(user_id, type, category, title, description, exchange_category, start_date, end_date, is_all_year ? 1 : 0, image_data);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/ads", (req, res) => {
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

    const ads = db.prepare(query).all(...params);
    res.json(ads);
  });

  app.get("/api/gallery", (req, res) => {
    const images = db.prepare("SELECT * FROM gallery ORDER BY created_at DESC").all();
    res.json(images);
  });

  app.post("/api/gallery", (req, res) => {
    const { image_data, caption } = req.body;
    try {
      const info = db.prepare("INSERT INTO gallery (image_data, caption) VALUES (?, ?)").run(image_data, caption);
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Messaging Routes
  app.post("/api/messages", (req, res) => {
    const { ad_id, sender_id, receiver_id, content, type } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO messages (ad_id, sender_id, receiver_id, content, type)
        VALUES (?, ?, ?, ?, ?)
      `).run(ad_id, sender_id, receiver_id, content, type || 'normal');
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/messages/ad/:adId", (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const ad = db.prepare("SELECT user_id FROM ads WHERE id = ?").get(req.params.adId) as any;
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
    
    const messages = db.prepare(query).all(...params);
    res.json(messages);
  });

  app.get("/api/messages/user/:userId", (req, res) => {
    const messages = db.prepare(`
      SELECT m.*, s.pseudo as sender_pseudo, r.pseudo as receiver_pseudo, a.title as ad_title
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      JOIN ads a ON m.ad_id = a.id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      ORDER BY m.created_at DESC
    `).all(req.params.userId, req.params.userId);
    res.json(messages);
  });

  app.patch("/api/ads/:id/status", (req, res) => {
    const { status } = req.body;
    try {
      db.prepare("UPDATE ads SET status = ? WHERE id = ?").run(status, req.params.id);
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
