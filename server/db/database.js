const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'mercadito.db');
const db = new Database(dbPath);

function initializeDatabase() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      permissions TEXT DEFAULT NULL,
      credit_balance REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',
      category_id INTEGER,
      image_url TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_price REAL NOT NULL,
      quantity REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed default settings
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
  const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of defaultSettings) insSetting.run(k, v);

  // Migrations
  const userCols = db.pragma('table_info(users)').map(c => c.name);
  if (!userCols.includes('permissions'))     db.exec("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT NULL");
  if (!userCols.includes('credit_balance'))  db.exec("ALTER TABLE users ADD COLUMN credit_balance REAL NOT NULL DEFAULT 0");

  const orderCols = db.pragma('table_info(orders)').map(c => c.name);
  if (!orderCols.includes('payment_method')) db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'efectivo'");
  if (!orderCols.includes('payment_status')) db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pendiente'");
  if (!orderCols.includes('payment_id'))     db.exec("ALTER TABLE orders ADD COLUMN payment_id TEXT DEFAULT NULL");

  const prodCols = db.pragma('table_info(products)').map(c => c.name);
  if (!prodCols.includes('cajon_price')) db.exec("ALTER TABLE products ADD COLUMN cajon_price REAL DEFAULT NULL");

  // Seed admin
  if (!db.prepare('SELECT id FROM users WHERE email = ?').get('admin@mercadito.com')) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (name, email, password, role, permissions) VALUES (?, ?, ?, ?, ?)')
      .run('Administrador', 'admin@mercadito.com', hash, 'admin', null);
    console.log('Admin created: admin@mercadito.com / admin123');
  }

  // Seed categories
  if (db.prepare('SELECT COUNT(*) as c FROM categories').get().c === 0) {
    const ic = db.prepare('INSERT INTO categories (id, name, slug, icon) VALUES (?, ?, ?, ?)');
    [[1,'Frutas','frutas','🍎'],[2,'Verduras','verduras','🥦'],[3,'Bebidas','bebidas','🥤'],
     [4,'Alimentos','alimentos','🥫'],[5,'Mascotas','mascotas','🐾'],[6,'Lena','lena','🪵'],
     [7,'Limpieza','limpieza','🧹']].forEach(r => ic.run(...r));
    console.log('Categories seeded');
  }

  // Seed products
  if (db.prepare('SELECT COUNT(*) as c FROM products').get().c === 0) {
    const ip = db.prepare('INSERT INTO products (name, price, stock, unit, category_id, active) VALUES (?, ?, ?, ?, ?, 1)');
    [
      ['Banana',90,100,'kg',1],['Manzana',120,80,'kg',1],['Naranja',100,100,'kg',1],
      ['Mandarina',95,80,'kg',1],['Pera',130,60,'kg',1],['Limon',80,120,'kg',1],
      ['Frutilla',250,40,'kg',1],['Kiwi',200,50,'kg',1],['Uva',180,50,'kg',1],
      ['Durazno',160,60,'kg',1],['Sandia',80,30,'kg',1],['Melon',110,25,'kg',1],
      ['Pina',200,20,'unidad',1],
      ['Papa',60,200,'kg',2],['Cebolla',70,150,'kg',2],['Tomate',110,100,'kg',2],
      ['Zanahoria',80,120,'kg',2],['Lechuga',60,80,'unidad',2],['Morron',150,60,'kg',2],
      ['Zapallito',90,70,'kg',2],['Calabaza',70,50,'kg',2],['Batata',75,100,'kg',2],
      ['Ajo',400,50,'kg',2],['Brocoli',130,40,'unidad',2],['Repollo',80,50,'unidad',2],
    ].forEach(p => ip.run(...p));
    console.log('Products seeded');
  }

  console.log('Database initialized successfully');
}

module.exports = { db, initializeDatabase };
