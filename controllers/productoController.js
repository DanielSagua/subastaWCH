const sql = require('mssql');
const db = require('../db/sql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + file.originalname;
    cb(null, unique);
  }
});

const upload = multer({ storage });

const productoController = {
  listarProductos: async (req, res) => {
    try {
      const pool = await db;
      const result = await pool.request().query(`
        SELECT 
          p.*, 
          (SELECT MAX(monto_oferta) FROM Ofertas WHERE id_producto = p.id_producto) AS oferta_maxima,
          u.nombre_usuario AS nombre_ganador
        FROM Productos p
        LEFT JOIN Usuarios u ON p.ganador_id = u.id_usuario
      `);
      res.json(result.recordset);
    } catch (error) {
      console.error('Error al listar productos:', error);
      res.status(500).json({ message: 'Error al obtener productos' });
    }
  },

  verProducto: async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await db;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT * FROM Productos WHERE id_producto = @id');
      res.json(result.recordset[0]);
    } catch (error) {
      console.error('Error al obtener producto:', error);
      res.status(500).json({ message: 'Error al obtener producto' });
    }
  },

  crearProducto: async (req, res) => {
    const { nombre, descripcion, precio } = req.body;
    const imagen = req.file?.filename || 'test.webp';

    try {
      const pool = await db;
      await pool.request()
        .input('nombre', sql.NVarChar, nombre)
        .input('descripcion', sql.NVarChar, descripcion)
        .input('precio', sql.Decimal(10, 2), precio)
        .input('imagen', sql.NVarChar, imagen)
        .query(`
          INSERT INTO Productos (nombre_producto, descripcion_producto, precio_producto, imagen)
          VALUES (@nombre, @descripcion, @precio, @imagen)
        `);

      const usuariosResult = await pool.request().query(`
        SELECT correo, nombre_usuario FROM Usuarios WHERE estado = 1
      `);
      for (const usuario of usuariosResult.recordset) {
        await transporter.sendMail({
          from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
          to: usuario.correo,
          subject: '🆕 Nuevo producto en subasta',
          html: `
            <p>Hola ${usuario.nombre_usuario},</p>
            <p>Se ha publicado un nuevo producto: <strong>${nombre}</strong> ($${precio})</p>
          `
        });
      }

      res.json({ message: 'Producto creado correctamente' });
    } catch (error) {
      console.error('Error al crear producto:', error);
      res.status(500).json({ message: 'Error al crear producto' });
    }
  },

  editarProducto: async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio } = req.body;
    const imagenNueva = req.file ? req.file.filename : null;

    try {
      const pool = await db;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT imagen FROM Productos WHERE id_producto = @id');
      const imagenActual = result.recordset[0]?.imagen;

      if (imagenNueva && imagenActual && imagenActual !== 'test') {
        const rutaImagen = path.join(__dirname, '..', 'public', 'uploads', imagenActual);
        if (fs.existsSync(rutaImagen)) fs.unlinkSync(rutaImagen);
      }

      const request = pool.request()
        .input('id', sql.Int, id)
        .input('nombre', sql.NVarChar, nombre)
        .input('descripcion', sql.NVarChar, descripcion)
        .input('precio', sql.Decimal(10, 2), precio);

      if (imagenNueva) {
        request.input('imagen', sql.NVarChar, imagenNueva);
        await request.query(`
          UPDATE Productos
          SET nombre_producto = @nombre,
              descripcion_producto = @descripcion,
              precio_producto = @precio,
              imagen = @imagen
          WHERE id_producto = @id
        `);
      } else {
        await request.query(`
          UPDATE Productos
          SET nombre_producto = @nombre,
              descripcion_producto = @descripcion,
              precio_producto = @precio
          WHERE id_producto = @id
        `);
      }

      res.json({ message: 'Producto actualizado correctamente' });
    } catch (error) {
      console.error('Error al editar producto:', error);
      res.status(500).json({ message: 'Error al actualizar producto' });
    }
  },

  eliminarProducto: async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await db;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT imagen FROM Productos WHERE id_producto = @id');
      const imagen = result.recordset[0]?.imagen;

      const ofertantes = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          SELECT DISTINCT u.correo, u.nombre_usuario
          FROM Ofertas o
          JOIN Usuarios u ON u.id_usuario = o.id_usuario
          WHERE o.id_producto = @id
        `);

      for (const usuario of ofertantes.recordset) {
        await transporter.sendMail({
          from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
          to: usuario.correo,
          subject: '❌ Subasta cancelada',
          html: `<p>Hola ${usuario.nombre_usuario},<br>La subasta del producto ID ${id} fue cancelada.</p>`
        });
      }

      await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM Ofertas WHERE id_producto = @id');
      await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM Productos WHERE id_producto = @id');

      if (imagen && imagen !== 'test') {
        const ruta = path.join(__dirname, '..', 'public', 'uploads', imagen);
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
      }

      res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      res.status(500).json({ message: 'Error al eliminar producto' });
    }
  },

  ofertar: async (req, res) => {
    const { id_producto } = req.params;
    const { monto } = req.body;
    const id_usuario = req.session.user?.id;

    if (!id_usuario) return res.status(403).json({ message: 'Debes iniciar sesión' });

    try {
      const pool = await db;

      const productoResult = await pool.request()
        .input('id_producto', sql.Int, id_producto)
        .query(`
    SELECT fecha_publicacion_producto, precio_producto 
    FROM Productos 
    WHERE id_producto = @id_producto
  `);
      const producto = productoResult.recordset[0];
      if (!producto) return res.status(404).json({ message: 'Producto no encontrado' });

      const fechaFin = new Date(producto.fecha_publicacion_producto).getTime() + 86400000;
      if (Date.now() > fechaFin) {
        return res.status(400).json({ message: 'La subasta ha finalizado' });
      }

      // ✅ Obtener la oferta más alta actual (ANTES de insertar)
      const anteriorResult = await pool.request()
        .input('id_producto', sql.Int, id_producto)
        .query(`
    SELECT TOP 1 o.id_usuario, u.correo, u.nombre_usuario, o.monto_oferta
    FROM Ofertas o
    JOIN Usuarios u ON u.id_usuario = o.id_usuario
    WHERE o.id_producto = @id_producto
    ORDER BY o.monto_oferta DESC
  `);

      const ofertaMaxima = anteriorResult.recordset[0]?.monto_oferta || 0;
      if (ofertaMaxima === 0 && monto <= producto.precio_producto) {
        return res.status(400).json({ message: 'La oferta inicial debe superar el precio base del producto.' });
      }

      const anteriorUsuario = anteriorResult.recordset[0];

      if (monto <= ofertaMaxima) return res.status(400).json({ message: 'Oferta muy baja' });

      // Insertar la nueva oferta
      await pool.request()
        .input('id_usuario', sql.Int, id_usuario)
        .input('id_producto', sql.Int, id_producto)
        .input('monto', sql.Decimal(10, 2), monto)
        .query('INSERT INTO Ofertas (id_usuario, id_producto, monto_oferta) VALUES (@id_usuario, @id_producto, @monto)');

      // Obtener datos del usuario actual
      const userResult = await pool.request()
        .input('id_usuario', sql.Int, id_usuario)
        .query('SELECT nombre_usuario, correo FROM Usuarios WHERE id_usuario = @id_usuario');
      const usuario = userResult.recordset[0];

      // Enviar correo de confirmación al ofertante actual
      await transporter.sendMail({
        from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
        to: usuario.correo,
        subject: '📝 Oferta registrada',
        html: `<p>Hola ${usuario.nombre_usuario}, tu oferta de $${monto} fue registrada en el producto ID ${id_producto}.</p>`
      });

      // ✅ Enviar correo al usuario anterior solo si es distinto
      if (anteriorUsuario && anteriorUsuario.id_usuario !== id_usuario) {
        await transporter.sendMail({
          from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
          to: anteriorUsuario.correo,
          subject: '📉 Has sido superado en una subasta',
          html: `
          <p>Hola ${anteriorUsuario.nombre_usuario},</p>
          <p>Tu oferta ya no es la más alta en el producto ID ${id_producto}.</p>
          <p>¡Haz tu mejor oferta para recuperar el liderazgo!</p>
        `
        });
      }

      res.json({ success: true, message: 'Oferta registrada' });
    } catch (error) {
      console.error('Error al ofertar:', error);
      if (!res.headersSent) res.status(500).json({ message: 'Error al ofertar' });
    }
  },



  finalizarSubasta: async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await db;
      const check = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT finalizada FROM Productos WHERE id_producto = @id');
      if (check.recordset[0]?.finalizada === true) {
        return res.status(400).json({ message: 'Subasta ya finalizada' });
      }

      const result = await pool.request()
        .input('id_producto', sql.Int, id)
        .query(`
          SELECT TOP 1 id_usuario
          FROM Ofertas
          WHERE id_producto = @id_producto
          ORDER BY monto_oferta DESC
        `);

      const ganador = result.recordset[0]?.id_usuario || null;

      await pool.request()
        .input('id', sql.Int, id)
        .input('ganador', sql.Int, ganador)
        .query(`
          UPDATE Productos
          SET finalizada = 1, ganador_id = @ganador
          WHERE id_producto = @id
        `);

      if (ganador) {
        const usuario = await pool.request()
          .input('id_usuario', sql.Int, ganador)
          .query('SELECT nombre_usuario, correo FROM Usuarios WHERE id_usuario = @id_usuario');
        await transporter.sendMail({
          from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
          to: usuario.recordset[0].correo,
          subject: '🎉 Has ganado la subasta',
          html: `<p>Hola ${usuario.recordset[0].nombre_usuario}, has ganado la subasta del producto ID ${id}.</p>`
        });
      }

      const ofertantes = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          SELECT DISTINCT u.correo, u.nombre_usuario
          FROM Ofertas o
          JOIN Usuarios u ON o.id_usuario = u.id_usuario
          WHERE o.id_producto = @id AND o.id_usuario <> ISNULL(${ganador}, -1)
        `);

      for (const usuario of ofertantes.recordset) {
        await transporter.sendMail({
          from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
          to: usuario.correo,
          subject: '📢 Subasta finalizada',
          html: `<p>Hola ${usuario.nombre_usuario}, la subasta del producto ID ${id} ha finalizado. Gracias por participar.</p>`
        });
      }

      await transporter.sendMail({
        from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
        to: 'admin@empresa.cl',
        subject: '📬 Subasta finalizada',
        html: `<p>La subasta ID ${id} ha finalizado.${ganador ? ` Ganador ID: ${ganador}` : ' Sin ganador.'}</p>`
      });

      res.json({ message: 'Subasta finalizada' });
    } catch (error) {
      console.error('Error al finalizar subasta:', error);
      res.status(500).json({ message: 'Error al finalizar subasta' });
    }
  }
};

module.exports = {
  ...productoController,
  upload
};