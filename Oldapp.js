const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const path = require('path');
const { isAuthenticated, isAdmin } = require('./middlewares/authMiddleware');
require('dotenv').config();

const app = express();

const usuarioRoutes = require('./routes/usuarios');
app.use('/', usuarioRoutes);

// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(session({
    secret: 'subastas-secret',
    resave: false,
    saveUninitialized: true
}));
app.use(flash());

app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));

// Vistas protegidas por sesión
app.get('/home.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

app.get('/producto.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'producto.html'));
});

// Vistas solo para admin
app.get('/admin.html', isAuthenticated, (req, res) => {
  if (req.session.user?.tipo !== 'admin') return res.status(403).send('Acceso restringido');
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/gestion-usuarios.html', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gestion-usuarios.html'));
});

app.get('/gestion-productos.html', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gestion-productos.html'));
});

// Y así para agregar/editar productos/usuarios también...


// Rutas
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);

// Ruta base
app.get('/', (req, res) => res.redirect('/login'));

//rutas API
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/usuarios'));
app.use('/', require('./routes/productos'));


const productoRoutes = require('./routes/productos');
app.use('/', productoRoutes);

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));