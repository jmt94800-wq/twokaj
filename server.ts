import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { Pool } from "pg";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Database Configuration
const isPostgres = !!process.env.POSTGRES_URL;
let db: any;
let pgPool: Pool | null = null;

if (isPostgres) {
  pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log("Attempting to connect to PostgreSQL (Neon/Vercel)...");
} else {
  db = new Database("twokaj.db");
  console.log("Using SQLite (Local)");
}

// Initialize Database
async function initDatabase() {
  try {
    if (isPostgres && pgPool) {
      // Test connection
      await pgPool.query('SELECT 1');
      console.log("PostgreSQL connection successful");

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
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
        );
        CREATE TABLE IF NOT EXISTS ads (
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
        );
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          ad_id TEXT,
          sender_id TEXT,
          receiver_id TEXT,
          content TEXT,
          type TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS gallery (
          id TEXT PRIMARY KEY,
          photo_url TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } else {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS ads (
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          ad_id TEXT,
          sender_id TEXT,
          receiver_id TEXT,
          content TEXT,
          type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS gallery (
          id TEXT PRIMARY KEY,
          photo_url TEXT,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
    console.log("Database tables initialized");
  } catch (err) {
    console.error("Database initialization failed:", err);
    // Don't exit process, maybe it's a temporary network issue
  }
}

async function startServer() {
  await initDatabase();
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Helper for queries to handle syntax differences
  const query = async (text: string, params: any[] = []) => {
    let processedText = text;
    if (!isPostgres) {
      // Convert $1, $2 to ? for SQLite
      processedText = text.replace(/\$\d+/g, '?');
    }
    
    try {
      if (isPostgres && pgPool) {
        const res = await pgPool.query(processedText, params);
        return res.rows;
      } else {
        const stmt = db.prepare(processedText);
        if (processedText.trim().toUpperCase().startsWith("SELECT")) {
          return stmt.all(...params);
        } else {
          return stmt.run(...params);
        }
      }
    } catch (err) {
      console.error("Query error:", err, "SQL:", processedText);
      throw err;
    }
  };

  // API Routes
  app.post("/api/auth/register", async (req, res) => {
    const { id, name, pseudo, address, phone, email, password, categories, profile_photo } = req.body;
    try {
      await query(`
        INSERT INTO users (id, name, pseudo, address, phone, email, password, categories, profile_photo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [id, name, pseudo, address, phone, email, password, JSON.stringify(categories), profile_photo]);
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const rows = await query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
      const user = rows[0];
      if (user) {
        user.categories = JSON.parse(user.categories || '[]');
        res.json(user);
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ads", async (req, res) => {
    try {
      const ads = await query(`
        SELECT ads.*, users.pseudo 
        FROM ads 
        JOIN users ON ads.user_id = users.id 
        WHERE ads.status = 'open'
        ORDER BY ads.created_at DESC
      `);
      res.json(ads.map((ad: any) => ({
        ...ad,
        availability: JSON.parse(ad.availability || '{}')
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ads", async (req, res) => {
    const { id, user_id, type, category, title, description, location, start_date, end_date, availability, photo } = req.body;
    try {
      await query(`
        INSERT INTO ads (id, user_id, type, category, title, description, location, start_date, end_date, availability, photo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [id, user_id, type, category, title, description, location, start_date, end_date, JSON.stringify(availability), photo]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/ads/:id/close", async (req, res) => {
    const { id } = req.params;
    try {
      await query("UPDATE ads SET status = 'closed' WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/messages/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const messages = await query(`
        SELECT messages.*, users.pseudo as sender_pseudo 
        FROM messages 
        JOIN users ON messages.sender_id = users.id
        WHERE receiver_id = $1 OR sender_id = $2
        ORDER BY created_at ASC
      `, [userId, userId]);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages", async (req, res) => {
    const { id, ad_id, sender_id, receiver_id, content, type } = req.body;
    try {
      await query(`
        INSERT INTO messages (id, ad_id, sender_id, receiver_id, content, type)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [id, ad_id, sender_id, receiver_id, content, type]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/gallery", async (req, res) => {
    try {
      const items = await query("SELECT * FROM gallery ORDER BY created_at DESC");
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gallery", async (req, res) => {
    const { id, photo_url, description } = req.body;
    try {
      await query("INSERT INTO gallery (id, photo_url, description) VALUES ($1, $2, $3)", [id, photo_url, description]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/sync", async (req, res) => {
    const { users: newUsers, ads: newAds, messages: newMessages } = req.body;
    
    try {
      if (newUsers) {
        for (const u of newUsers) {
          const sql = isPostgres 
            ? `INSERT INTO users (id, name, pseudo, address, phone, email, password, categories, profile_photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, pseudo=EXCLUDED.pseudo, address=EXCLUDED.address, phone=EXCLUDED.phone, email=EXCLUDED.email, password=EXCLUDED.password, categories=EXCLUDED.categories, profile_photo=EXCLUDED.profile_photo`
            : `INSERT INTO users (id, name, pseudo, address, phone, email, password, categories, profile_photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET name=excluded.name, pseudo=excluded.pseudo, address=excluded.address, phone=excluded.phone, email=excluded.email, password=excluded.password, categories=excluded.categories, profile_photo=excluded.profile_photo`;
          
          await query(sql, [u.id, u.name, u.pseudo, u.address, u.phone, u.email, u.password, JSON.stringify(u.categories), u.profile_photo]);
        }
      }
      if (newAds) {
        for (const a of newAds) {
          const sql = isPostgres
            ? `INSERT INTO ads (id, user_id, type, category, title, description, location, start_date, end_date, availability, photo, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status`
            : `INSERT INTO ads (id, user_id, type, category, title, description, location, start_date, end_date, availability, photo, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO UPDATE SET status=excluded.status`;
          
          await query(sql, [a.id, a.user_id, a.type, a.category, a.title, a.description, a.location, a.start_date, a.end_date, JSON.stringify(a.availability), a.photo, a.status]);
        }
      }
      if (newMessages) {
        for (const m of newMessages) {
          const sql = isPostgres
            ? `INSERT INTO messages (id, ad_id, sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`
            : `INSERT INTO messages (id, ad_id, sender_id, receiver_id, content, type) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`;
          
          await query(sql, [m.id, m.ad_id, m.sender_id, m.receiver_id, m.content, m.type]);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
