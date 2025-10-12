const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();
const sql = require('mssql');
const db = require('./db/sql');
const { cerrarSubastaYNotificar } = require('./controllers/productoController');

const DURACION_MIN = parseInt(process.env.SUBASTA_DURACION_MINUTOS || '2880', 10);
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';


const { isAuthenticated, isAdmin } = require('./middlewares/authMiddleware');

const app = express();

// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.use(session({
  secret: 'subastas-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

//Ofertas de productos
const { listarOfertasPorProducto } = require('./controllers/productoController');
app.get('/producto/:id/ofertas', listarOfertasPorProducto);



// Archivos públicos y vistas
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));

//Vista Login
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

//vista recuperar-password
app.get('/recuperar-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'recuperar-password.html'));
});

app.get('/cambiar-password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'cambiar-password.html'));
});


// ✅ Rutas protegidas (vistas HTML)
app.get('/home.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

app.get('/producto.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'producto.html'));
});

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

app.get('/agregar-usuario.html', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'agregar-usuario.html'));
});

app.get('/editar-usuario.html', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'editar-usuario.html'));
});

app.get('/agregar-producto.html', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'agregar-producto.html'));
});

app.get('/editar-producto.html', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'editar-producto.html'));
});

const usuariosRouter = require('./routes/usuarios');
app.use('/', usuariosRouter); // 👈 así /usuarios/:id llega al router

// 🧩 Rutas API
const authRoutes = require('./routes/auth');
const usuarioRoutes = require('./routes/usuarios');
const productoRoutes = require('./routes/productos');

app.use('/', authRoutes);
app.use('/', usuarioRoutes);
app.use('/', productoRoutes);



// Ruta base
app.get('/', (req, res) => res.redirect('/login.html'));

async function cerrarExpiradasJob() {
  try {
    const pool = await db;

    const vencidas = await pool.request().query(`
  SELECT id_producto
  FROM Productos
  WHERE finalizada = 0
    AND GETDATE() >= DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(fecha_publicacion_producto AS date)) AS datetime))
`);



    // 09102025
    // const vencidas = await pool.request()
    //   .input('duracion', sql.Int, DURACION_MIN)
    //   .query(`
    //     SELECT id_producto
    //     FROM Productos
    //     WHERE finalizada = 0
    //       AND DATEADD(MINUTE, @duracion, fecha_publicacion_producto) <= GETDATE()
    //   `);

    for (const row of vencidas.recordset) {
      await cerrarSubastaYNotificar(pool, BASE_URL, row.id_producto);
    }

    if (vencidas.recordset.length > 0) {
      console.log(`[subastas] cerradas automáticamente: ${vencidas.recordset.length}`);
    }
  } catch (err) {
    console.error('[subastas] error en job automático:', err);
  }
}

// Ejecuta al iniciar
cerrarExpiradasJob();
// Y cada 60 segundos
setInterval(cerrarExpiradasJob, 60 * 1000);


// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
