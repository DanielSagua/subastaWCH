function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  return res.redirect('/login.html');
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.tipo === 'admin') {
    return next();
  }
  return res.status(403).send('Acceso denegado');
}

module.exports = {
  isAuthenticated,
  isAdmin
};
