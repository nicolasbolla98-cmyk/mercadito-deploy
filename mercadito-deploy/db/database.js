                                                                             
  const Database = require('better-sqlite3');                                   
  const bcrypt = require('bcryptjs');                                           
  const path = require('path');                                                 
                                                                                
  const db = new Database(path.join(__dirname, 'mercadito.db'));                
                                                                                
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)                            
      );                                      
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,                                              
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,                                             
        product_price REAL NOT NULL,
        quantity INTEGER NOT NULL,                                            
        subtotal REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);                                                                         
   
    const adminHash = bcrypt.hashSync('admin123', 10);                          
    const admin = db.prepare('SELECT id, password FROM users WHERE email = 
  ?').get('admin@mercadito.com');                                             
    if (!admin) {                                                               
      db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, 
  ?, ?)`).run('Administrador', 'admin@mercadito.com', adminHash, 'admin');      
      console.log('Admin creado');        
    } else if (!admin.password || !admin.password.startsWith('$2')) {         
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(adminHash,   
  admin.id);                                  
      console.log('Admin password corregida');                                  
    }             
                                                                                
    const cats = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (cats.count === 0) {                                                     
      const ins = db.prepare('INSERT INTO categories (id, name, slug, icon) 
  VALUES (?, ?, ?, ?)');                                                      
      [[1,'Frutas','frutas','🍎'],[2,'Verduras','verduras','🥦'],[3,'Bebidas','b
  ebidas','🥤'],[4,'Alimentos','alimentos','🥫'],[5,'Mascotas','mascotas','🐾'],
  [6,'Leña','lena','🪵 '],[7,'Limpieza','limpieza','🧹']].forEach(c =>           
  ins.run(...c));
    }                                                                           
                  
    const prods = db.prepare('SELECT COUNT(*) as count FROM products').get();   
    if (prods.count === 0) {
      const ins = db.prepare(`INSERT INTO products (name, price, stock, unit, 
  category_id, active) VALUES (?, ?, ?, ?, ?, 1)`);
      [['Manzana',120,50,'kg',1],['Banana',90,80,'kg',1],['Naranja',110,60,'kg',
  1],['Uva',180,30,'kg',1],['Pera',130,40,'kg',1],['Durazno',160,35,'kg',1],['Fr
  utilla',250,20,'kg',1],['Piña',200,25,'unidad',1]].forEach(p =>
  ins.run(...p));                                                               
    }                                                                           
                                                                              
    console.log('Database initialized successfully');                           
  }               
                                                                              
  module.exports = { db, initializeDatabase };
