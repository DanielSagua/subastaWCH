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


// Configurar almacenamiento con multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads');
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + file.originalname;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = /jpeg|jpg|png|webp/;
    const esValido = tiposPermitidos.test(file.mimetype);
    if (esValido) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes .jpg, .png o .webp'));
    }
  }
});



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
        .query(`
          SELECT * FROM Productos WHERE id_producto = @id
        `);
      res.json(result.recordset[0]);
    } catch (error) {
      console.error('Error al obtener producto:', error);
      res.status(500).json({ message: 'Error al obtener producto' });
    }
  },

  crearProducto: async (req, res) => {
    const { nombre, descripcion, precio } = req.body;
    const imagen = req.file ? req.file.filename : null;

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
      res.json({ success: true, message: 'Producto agregado con imagen' });
    } catch (error) {
      console.error('Error al agregar producto con imagen:', error);
      res.status(500).json({ message: 'Error al guardar producto' });
    }
  },

  ofertar: async (req, res) => {
    const { id_producto } = req.params;
    const { monto } = req.body;
    const id_usuario = req.session.user?.id;

    if (!id_usuario) {
      return res.status(403).json({ message: 'Debes iniciar sesión' });
    }

    try {
      const pool = await db;

      // 1. Obtener producto y verificar si está activa
      const productoResult = await pool.request()
        .input('id_producto', sql.Int, id_producto)
        .query(`SELECT fecha_publicacion_producto FROM Productos WHERE id_producto = @id_producto`);

      const producto = productoResult.recordset[0];
      if (!producto) {
        return res.status(404).json({ message: 'Producto no encontrado' });
      }

      const fechaPublicacion = new Date(producto.fecha_publicacion_producto);
      const fechaFin = new Date(fechaPublicacion.getTime() + 24 * 60 * 60 * 1000);
      const ahora = new Date();

      if (ahora > fechaFin) {
        return res.status(400).json({ message: 'La subasta ha finalizado. No puedes ofertar.' });
      }

      // 2. Verificar que la oferta sea mayor
      const result = await pool.request()
        .input('id_producto', sql.Int, id_producto)
        .query('SELECT MAX(monto_oferta) AS max FROM Ofertas WHERE id_producto = @id_producto');

      const ofertaMaxima = result.recordset[0].max || 0;
      if (monto <= ofertaMaxima) {
        return res.status(400).json({ message: 'Tu oferta debe ser mayor a la actual' });
      }

      // 3. Insertar la oferta
      await pool.request()
        .input('id_usuario', sql.Int, id_usuario)
        .input('id_producto', sql.Int, id_producto)
        .input('monto', sql.Decimal(10, 2), monto)
        .query(`
        INSERT INTO Ofertas (id_usuario, id_producto, monto_oferta)
        VALUES (@id_usuario, @id_producto, @monto)
      `);

      // 4. Obtener datos del usuario para enviar correo
      const userResult = await pool.request()
        .input('id_usuario', sql.Int, id_usuario)
        .query('SELECT nombre_usuario, correo FROM Usuarios WHERE id_usuario = @id_usuario');

      const usuario = userResult.recordset[0];

      const mailOptions = {
        from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
        to: usuario.correo,
        subject: '📝 Confirmación de oferta registrada',
        html: `
        <p>Hola ${usuario.nombre_usuario},</p>
        <p>Hemos registrado tu oferta de <strong>$${monto}</strong> para el producto <strong>ID ${id_producto}</strong>.</p>
        <p>Puedes seguir compitiendo mientras la subasta esté abierta.</p>
        <hr>
        <p>Este es un correo automático del sistema de subastas internas.</p>
      `
      };

      // 5. Enviar correo (opcionalmente con catch)
      try {
        await transporter.sendMail(mailOptions);
      } catch (correoError) {
        console.warn('⚠️ Error al enviar correo de oferta:', correoError.message);
      }

      // 6. Confirmar al frontend
      res.json({ success: true, message: 'Oferta registrada con éxito' });

    } catch (error) {
      console.error('Error al ofertar:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error al registrar la oferta' });
      }
    }
  },


  editarProducto: async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio } = req.body;
    const imagenNueva = req.file ? req.file.filename : null;

    try {
      const pool = await db;

      // Obtener nombre de imagen actual
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT imagen FROM Productos WHERE id_producto = @id');

      const imagenActual = result.recordset[0]?.imagen;

      // Si hay nueva imagen, y la anterior no es 'test', eliminarla
      if (imagenNueva && imagenActual && imagenActual !== 'test') {
        const rutaImagen = path.join(__dirname, '..', 'public', 'uploads', imagenActual);
        if (fs.existsSync(rutaImagen)) {
          fs.unlinkSync(rutaImagen);
        }
      }

      // Actualizar producto
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


  finalizarSubasta: async (req, res) => {
    const { id } = req.params;

    try {
      const pool = await db;

      // Validar si ya está finalizada
      const check = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT finalizada FROM Productos WHERE id_producto = @id');

      if (check.recordset[0]?.finalizada === true) {
        return res.status(400).json({ message: 'La subasta ya fue finalizada' });
      }

      // Obtener la oferta más alta y su usuario
      const result = await pool.request()
        .input('id_producto', sql.Int, id)
        .query(`
        SELECT TOP 1 id_usuario
        FROM Ofertas
        WHERE id_producto = @id_producto
        ORDER BY monto_oferta DESC
      `);

      const ganador = result.recordset[0]?.id_usuario || null;

      // Después de guardar el ganador_id:
      if (ganador) {
        // Obtener correo y nombre del usuario
        const usuarioResult = await pool.request()
          .input('id_usuario', sql.Int, ganador)
          .query('SELECT nombre_usuario, correo FROM Usuarios WHERE id_usuario = @id_usuario');

        const usuario = usuarioResult.recordset[0];

        // Enviar correo
        const mailOptions = {
          from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
          to: usuario.correo,
          subject: '🎉 ¡Has ganado una subasta!',
          html: `
      <p>Hola ${usuario.nombre_usuario},</p>
      <p>¡Felicitaciones! Has ganado la subasta del producto <strong>ID ${id}</strong>.</p>
      <p>En breve nos pondremos en contacto contigo para coordinar la entrega.</p>
      <hr>
      <p>Este es un correo automático del sistema de subastas internas.</p>
    `
        };

        await transporter.sendMail(mailOptions);
      }


      // Actualizar producto
      await pool.request()
        .input('id', sql.Int, id)
        .input('ganador', sql.Int, ganador)
        .query(`
        UPDATE Productos
        SET finalizada = 1,
            ganador_id = @ganador
        WHERE id_producto = @id
      `);

      res.json({ message: ganador ? `Subasta finalizada. Ganador ID: ${ganador}` : 'Subasta finalizada. Sin ofertas.' });
    } catch (error) {
      console.error('Error al finalizar subasta:', error);
      res.status(500).json({ message: 'Error al cerrar la subasta' });
    }
  },


  eliminarProducto: async (req, res) => {
    const { id } = req.params;

    try {
      const pool = await db;

      // 1. Obtener nombre de la imagen
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT imagen FROM Productos WHERE id_producto = @id');

      const imagen = result.recordset[0]?.imagen;

      // 2. Eliminar ofertas asociadas
      await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM Ofertas WHERE id_producto = @id');

      // 3. Eliminar producto
      await pool.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM Productos WHERE id_producto = @id');

      // 4. Eliminar imagen si corresponde
      if (imagen && imagen !== 'test') {
        const rutaImagen = path.join(__dirname, '..', 'public', 'uploads', imagen);
        if (fs.existsSync(rutaImagen)) {
          fs.unlinkSync(rutaImagen);
        }
      }

      res.json({ message: 'Producto eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      res.status(500).json({ message: 'Error al eliminar producto' });
    }
  }


};

module.exports = {
  ...productoController,
  upload
};

