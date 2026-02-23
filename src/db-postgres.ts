import { sql } from '@vercel/postgres';

export async function initPostgres() {
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
