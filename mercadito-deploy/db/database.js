const Database = require('better-sqlite3');
  const bcrypt = require('bcryptjs');
  const path = require('path');                                                 
  const db = new Database(path.join(__dirname, 'mercadito.db'));
  function initializeDatabase() {                                               
    db.pragma('journal_mode = WAL');          
    db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY 
  AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT, 
  password TEXT NOT NULL, role TEXT NOT NULL DEFAULT "customer", created_at     
  DATETIME DEFAULT CURRENT_TIMESTAMP)');
    db.exec('CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY      
  AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, icon TEXT, 
  active INTEGER NOT NULL DEFAULT 1)');                                         
    db.exec('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY 
  AUTOINCREMENT, name TEXT NOT NULL, description TEXT, price REAL NOT NULL,     
  stock INTEGER NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT "kg", category_id
   INTEGER, image_url TEXT, active INTEGER NOT NULL DEFAULT 1, created_at       
  DATETIME DEFAULT CURRENT_TIMESTAMP)');                                        
    db.exec('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY 
  AUTOINCREMENT, user_id INTEGER, customer_name TEXT NOT NULL, customer_email   
  TEXT NOT NULL, customer_phone TEXT, customer_address TEXT, notes TEXT, total 
  REAL NOT NULL, status TEXT NOT NULL DEFAULT "pendiente", created_at DATETIME 
  DEFAULT CURRENT_TIMESTAMP)');                                                 
    db.exec('CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY 
  AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL,        
  product_name TEXT NOT NULL, product_price REAL NOT NULL, quantity INTEGER NOT 
  NULL, subtotal REAL NOT NULL)');
    var adminPass = process.env.ADMIN_PASSWORD || 'admin123';                   
    var adminHash = bcrypt.hashSync(adminPass, 10);
    var admin = db.prepare('SELECT id FROM users WHERE email =                  
  ?').get('admin@mercadito.com');             
    if (!admin) {                                                               
      db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, 
  ?, ?)').run('Administrador', 'admin@mercadito.com', adminHash, 'admin');      
    } else {                              
      db.prepare('UPDATE users SET password = ? WHERE email = ?').run(adminHash,
   'admin@mercadito.com');                                                      
    }
    var cats = db.prepare('SELECT COUNT(*) as count FROM categories').get();    
    if (cats.count === 0) {                   
      var ins = db.prepare('INSERT INTO categories (id, name, slug, icon) VALUES
   (?, ?, ?, ?)');
      [[1,'Frutas','frutas',''],[2,'Verduras','verduras',''],[3,'Bebidas','bebid
  as',''],[4,'Alimentos','alimentos',''],[5,'Mascotas','mascotas',''],[6,'Lena',
  'lena',''],[7,'Limpieza','limpieza','']].forEach(function(c){                 
  ins.run(c[0],c[1],c[2],c[3]); });
    }                                                                           
    var prods = db.prepare('SELECT COUNT(*) as count FROM products').get();
    if (prods.count === 0) {                                                    
      var inp = db.prepare('INSERT INTO products (name, price, stock, unit, 
  category_id, active) VALUES (?, ?, ?, ?, ?, 1)');
      [['Manzana',120,50,'kg',1],['Banana',90,80,'kg',1],['Naranja',110,60,'kg',
  1],['Uva',180,30,'kg',1],['Pera',130,40,'kg',1],['Durazno',160,35,'kg',1],['Fr
  utilla',250,20,'kg',1],['Pina',200,25,'unidad',1]].forEach(function(p){       
  inp.run(p[0],p[1],p[2],p[3],p[4]); });
    }                                                                           
    console.log('Database OK');
  }                                                                             
  module.exports = { db, initializeDatabase };
