require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  // En producción el frontend compilado vive en ../public
  app.use(express.static(path.join(__dirname, 'public')));
} else {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

initializeDatabase();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

// En producción, todas las rutas no-API devuelven el index.html de React
if (isProd) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
