const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Token invalido' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  next();
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    const perms = req.user?.permissions;
    if (!perms || perms === 'all') return next();
    try {
      const arr = JSON.parse(perms);
      if (arr.includes('all') || arr.includes(permission)) return next();
    } catch {}
    return res.status(403).json({ error: 'Sin permiso para esta accion' });
  };
}

module.exports = { authenticateToken, requireAdmin, requirePermission };
