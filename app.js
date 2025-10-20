// requires básicos
const express = require('express');
const session = require('express-session');
const MSSQLStore = require('connect-mssql-v2');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

//Crar app antes de ser utilizada
const app = express();

//requires que no necesitan app
const sql = require('mssql');
const db = require('./db/sql');
const { cerrarSubastaYNotificar } = require('./controllers/productoController');
const { isAuthenticated, isAdmin } = require('./middlewares/authMiddleware');
const productoController = require('./controllers/productoController');

//Variables varias
const port = process.env.PORT || 3000;    // 👈 define 'port' correctamente
const DURACION_MIN = parseInt(process.env.SUBASTA_DURACION_MINUTOS || '2880', 10);
const BASE_URL = process.env.BASE_URL || 'https://subastaswch.wch-ops.cl';
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

// middleware de auth mínimo mis ofertas
function ensureAuth(req, res, next) {
  if (req.session?.user?.id) return next();
  return res.status(401).json({ message: 'No autenticado' });
}

app.get('/usuario/mis-ofertas', ensureAuth, productoController.listarMisOfertas);


//Rutas

//TCP TEST
// const net = require('net');
// app.get('/tcp-test', (req, res) => {
//   const host = process.env.DB_SERVER;
//   const port = parseInt(process.env.DB_PORT || '1433', 10);
//   const socket = new net.Socket();
//   const timeoutMs = 4000;

//   socket.setTimeout(timeoutMs);
//   socket.once('connect', () => { socket.destroy(); res.json({ ok: true, host, port }); });
//   socket.once('timeout', () => { socket.destroy(); res.status(504).json({ ok: false, error: 'timeout', host, port }); });
//   socket.once('error', (err) => { socket.destroy(); res.status(500).json({ ok: false, error: String(err), host, port }); });

//   socket.connect(port, host);
// });

//Test
// app.get('/db-test', async (_req, res) => {
//   try {
//     const pool = await db;
//     const result = await pool.request().query('SELECT TOP 1 GETDATE() as ahora');
//     res.json({ ok: true, ahora: result.recordset[0].ahora });
//   } catch (e) {
//     console.error('DB test error:', e);
//     res.status(500).json({ ok: false, error: String(e) });
//   }
// });

//Ofertas de Productos
const { listarOfertasPorProducto } = require('./controllers/productoController');
app.get('/producto/:id/ofertas', listarOfertasPorProducto);

//Mis Ofertas
app.get('/misOfertas.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'misOfertas.html'));
});


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



async function cerrarExpiradasJob() {
  try {
    const pool = await db;

    const vencidas = await pool.request().query(`
  SELECT id_producto
  FROM Productos
  WHERE finalizada = 0
    AND GETDATE() >= DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(fecha_publicacion_producto AS date)) AS datetime))
`);



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

// app.get('/', (_req, res) => {
//   res.send('<h1>Bienvenido a SubastasWCH</h1><p>Servidor Node.js activo en subastaswch.wch-ops.cl</p>');
// });

// Ruta principal:
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Ruta de prueba
app.get('/status', (_req, res) => res.send('OK'));

// Arranque
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});