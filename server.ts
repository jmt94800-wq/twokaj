import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const db = new Database("twokaj.db");

// Initialize Database
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    ad_id TEXT,
    sender_id TEXT,
    receiver_id TEXT,
    content TEXT,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ad_id) REFERENCES ads(id),
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY,
    photo_url TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/auth/register", (req, res) => {
    const { id, name, pseudo, address, phone, email, password, categories, profile_photo } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO users (id, name, pseudo, address, phone, email, password, categories, profile_photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, name, pseudo, address, phone, email, password, JSON.stringify(categories), profile_photo);
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password) as any;
    if (user) {
      user.categories = JSON.parse(user.categories || '[]');
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/ads", (req, res) => {
    const ads = db.prepare(`
      SELECT ads.*, users.pseudo, users.address as user_address 
      FROM ads 
      JOIN users ON ads.user_id = users.id 
      WHERE ads.status = 'open'
      ORDER BY ads.created_at DESC
    `).all();
    res.json(ads.map((ad: any) => ({
      ...ad,
      availability: JSON.parse(ad.availability || '{}')
    })));
  });

  app.post("/api/ads", (req, res) => {
    const { id, user_id, type, category, title, description, location, start_date, end_date, availability, photo } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO ads (id, user_id, type, category, title, description, location, start_date, end_date, availability, photo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, user_id, type, category, title, description, location, start_date, end_date, JSON.stringify(availability), photo);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/ads/:id/close", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE ads SET status = 'closed' WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/messages/:userId", (req, res) => {
    const { userId } = req.params;
    const messages = db.prepare(`
      SELECT messages.*, users.pseudo as sender_pseudo 
      FROM messages 
      JOIN users ON messages.sender_id = users.id
      WHERE receiver_id = ? OR sender_id = ?
      ORDER BY created_at ASC
    `).all(userId, userId);
    res.json(messages);
  });

  app.post("/api/messages", (req, res) => {
    const { id, ad_id, sender_id, receiver_id, content, type } = req.body;
    db.prepare(`
      INSERT INTO messages (id, ad_id, sender_id, receiver_id, content, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, ad_id, sender_id, receiver_id, content, type);
    res.json({ success: true });
  });

  app.get("/api/gallery", (req, res) => {
    const items = db.prepare("SELECT * FROM gallery ORDER BY created_at DESC").all();
    res.json(items);
  });

  app.post("/api/gallery", (req, res) => {
    const { id, photo_url, description } = req.body;
    db.prepare("INSERT INTO gallery (id, photo_url, description) VALUES (?, ?, ?)").run(id, photo_url, description);
    res.json({ success: true });
  });

  // Sync endpoint for offline data
  app.post("/api/sync", async (req, res) => {
    const { users: newUsers, ads: newAds, messages: newMessages } = req.body;
    
    db.transaction(() => {
      if (newUsers) {
        for (const u of newUsers) {
          db.prepare(`INSERT OR REPLACE INTO users (id, name, pseudo, address, phone, email, password, categories, profile_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            u.id, u.name, u.pseudo, u.address, u.phone, u.email, u.password, JSON.stringify(u.categories), u.profile_photo
          );
        }
      }
      if (newAds) {
        for (const a of newAds) {
          db.prepare(`INSERT OR REPLACE INTO ads (id, user_id, type, category, title, description, location, start_date, end_date, availability, photo, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            a.id, a.user_id, a.type, a.category, a.title, a.description, a.location, a.start_date, a.end_date, JSON.stringify(a.availability), a.photo, a.status
          );
        }
      }
      if (newMessages) {
        for (const m of newMessages) {
          db.prepare(`INSERT OR REPLACE INTO messages (id, ad_id, sender_id, receiver_id, content, type) VALUES (?, ?, ?, ?, ?, ?)`).run(
            m.id, m.ad_id, m.sender_id, m.receiver_id, m.content, m.type
          );
        }
      }
    })();

    res.json({ success: true });
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
