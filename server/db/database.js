const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // ── Create tables ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        permissions TEXT DEFAULT NULL,
        credit_balance REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        icon TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        unit TEXT NOT NULL DEFAULT 'kg',
        category_id INTEGER REFERENCES categories(id),
        image_url TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        customer_address TEXT,
        notes TEXT,
        total REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendiente',
        payment_method TEXT DEFAULT 'efectivo',
        payment_status TEXT DEFAULT 'pendiente',
        payment_id TEXT DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity REAL NOT NULL,
        subtotal REAL NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // ── Column migrations (idempotent) ─────────────────────────────────────────
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance REAL NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'efectivo'`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendiente'`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT DEFAULT NULL`);
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cajon_price REAL DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_credit_order INTEGER NOT NULL DEFAULT 0`);

    // ── Seed default settings ──────────────────────────────────────────────────
    const defaultSettings = [
      ['store_name', 'Mercadito la U'],
      ['whatsapp', '59894022121'],
      ['address', 'Ruta Interbalnearia km 36.500, Empalme Olmos'],
      ['hours', 'Lun-Sab 8:00-20:00 | Dom 8:00-14:00'],
      ['bank_name', ''],
      ['bank_account_holder', ''],
      ['bank_account_number', ''],
      ['bank_extra', ''],
      ['transfer_note', 'Una vez realizada la transferencia, envia el comprobante por WhatsApp.'],
    ];
    for (const [k, v] of defaultSettings) {
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [k, v]
      );
    }

    // ── Seed admin ─────────────────────────────────────────────────────────────
    const adminCheck = await client.query('SELECT id FROM users WHERE email = $1', ['admin@mercadito.com']);
    if (adminCheck.rows.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await client.query(
        'INSERT INTO users (name, email, password, role, permissions) VALUES ($1, $2, $3, $4, $5)',
        ['Administrador', 'admin@mercadito.com', hash, 'admin', null]
      );
      console.log('Admin created: admin@mercadito.com / admin123');
    }

    // ── Seed categories ────────────────────────────────────────────────────────
    const catCount = await client.query('SELECT COUNT(*) as c FROM categories');
    if (parseInt(catCount.rows[0].c, 10) === 0) {
      const cats = [
        [1, 'Frutas', 'frutas', '🍎'],
        [2, 'Verduras', 'verduras', '🥦'],
        [3, 'Bebidas', 'bebidas', '🥤'],
        [4, 'Alimentos', 'alimentos', '🥫'],
        [5, 'Mascotas', 'mascotas', '🐾'],
        [6, 'Lena', 'lena', '🪵'],
        [7, 'Limpieza', 'limpieza', '🧹'],
      ];
      for (const [id, name, slug, icon] of cats) {
        await client.query(
          'INSERT INTO categories (id, name, slug, icon) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [id, name, slug, icon]
        );
      }
      // Advance the sequence past the manually-inserted ids
      await client.query(`SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories))`);
      console.log('Categories seeded');
    }

    // ── Seed products ──────────────────────────────────────────────────────────
    const prodCount = await client.query('SELECT COUNT(*) as c FROM products');
    if (parseInt(prodCount.rows[0].c, 10) === 0) {
      const products = [
        ['Banana', 90, 100, 'kg', 1], ['Manzana', 120, 80, 'kg', 1], ['Naranja', 100, 100, 'kg', 1],
        ['Mandarina', 95, 80, 'kg', 1], ['Pera', 130, 60, 'kg', 1], ['Limon', 80, 120, 'kg', 1],
        ['Frutilla', 250, 40, 'kg', 1], ['Kiwi', 200, 50, 'kg', 1], ['Uva', 180, 50, 'kg', 1],
        ['Durazno', 160, 60, 'kg', 1], ['Sandia', 80, 30, 'kg', 1], ['Melon', 110, 25, 'kg', 1],
        ['Pina', 200, 20, 'unidad', 1],
        ['Papa', 60, 200, 'kg', 2], ['Cebolla', 70, 150, 'kg', 2], ['Tomate', 110, 100, 'kg', 2],
        ['Zanahoria', 80, 120, 'kg', 2], ['Lechuga', 60, 80, 'unidad', 2], ['Morron', 150, 60, 'kg', 2],
        ['Zapallito', 90, 70, 'kg', 2], ['Calabaza', 70, 50, 'kg', 2], ['Batata', 75, 100, 'kg', 2],
        ['Ajo', 400, 50, 'kg', 2], ['Brocoli', 130, 40, 'unidad', 2], ['Repollo', 80, 50, 'unidad', 2],
      ];
      for (const [name, price, stock, unit, category_id] of products) {
        await client.query(
          'INSERT INTO products (name, price, stock, unit, category_id, active) VALUES ($1, $2, $3, $4, $5, 1)',
          [name, price, stock, unit, category_id]
        );
      }
      console.log('Products seeded');
    }

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };
