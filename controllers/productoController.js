const sql = require('mssql');
const db = require('../db/sql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const ENVIAR_CORREOS = process.env.ENVIAR_CORREOS === 'true';
const DURACION_MIN = parseInt(process.env.SUBASTA_DURACION_MINUTOS || '2880', 10); // minutos

// ⬇️ Plantillas
const {
  tplNuevoProducto,
  tplSubastaCancelada,
  tplOfertaRegistrada,
  tplHasSidoSuperado,
  tplGanasteSubasta,
  tplSubastaFinalizadaParaParticipante,
  tplSubastaFinalizadaAdmin
} = require('../emails/builders');

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

// Helper: cierra subasta + envía correos (ganador, participantes, admin)
async function cerrarSubastaYNotificar(pool, ctx, id_producto) {
  // ctx puede ser req (Express) o un string con la baseUrl
  const baseUrl = (typeof ctx === 'string')
    ? ctx
    : `${ctx.protocol}://${ctx.get('host')}`;

  const check = await pool.request()
    .input('id', sql.Int, id_producto)
    .query('SELECT finalizada, nombre_producto FROM Productos WHERE id_producto = @id');

  const row = check.recordset[0];
  if (!row || row.finalizada === 1 || row.finalizada === true) return;

  const resGanador = await pool.request()
    .input('id_producto', sql.Int, id_producto)
    .query(`
      SELECT TOP 1 id_usuario
      FROM Ofertas
      WHERE id_producto = @id_producto
      ORDER BY monto_oferta DESC
    `);

  const ganador = resGanador.recordset[0]?.id_usuario || null;
  const nombreProducto = row.nombre_producto;

  await pool.request()
    .input('id', sql.Int, id_producto)
    .input('ganador', sql.Int, ganador)
    .query(`
      UPDATE Productos
      SET finalizada = 1, ganador_id = @ganador
      WHERE id_producto = @id
    `);

  const urlProducto = `${baseUrl}/producto.html?id=${id_producto}`;

  if (ENVIAR_CORREOS) {
    // Ganador
    if (ganador) {
      const u = await pool.request()
        .input('id_usuario', sql.Int, ganador)
        .query('SELECT nombre_usuario, correo FROM Usuarios WHERE id_usuario = @id_usuario');

      const { subject, html } = tplGanasteSubasta({
        nombreUsuario: u.recordset[0].nombre_usuario,
        nombreProducto,
        urlProducto
      });
      await transporter.sendMail({
        from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
        to: u.recordset[0].correo,
        subject,
        html
      });
    }

    // Participantes no ganadores
    const ofertantes = await pool.request()
      .input('id', sql.Int, id_producto)
      .query(`
        SELECT DISTINCT u.correo, u.nombre_usuario
        FROM Ofertas o
        JOIN Usuarios u ON o.id_usuario = u.id_usuario
        WHERE o.id_producto = @id AND o.id_usuario <> ISNULL(${ganador}, -1)
      `);

    for (const usuario of ofertantes.recordset) {
      const { subject, html } = tplSubastaFinalizadaParaParticipante({
        nombreUsuario: usuario.nombre_usuario,
        nombreProducto,
        urlProducto
      });
      await transporter.sendMail({
        from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
        to: usuario.correo,
        subject,
        html
      });
    }

    // Admin: nombre del ganador (no ID)
    let nombreGanador = null;
    if (ganador) {
      const u2 = await pool.request()
        .input('id_usuario', sql.Int, ganador)
        .query('SELECT nombre_usuario FROM Usuarios WHERE id_usuario = @id_usuario');
      nombreGanador = u2.recordset[0]?.nombre_usuario || null;
    }

    const { subject, html } = tplSubastaFinalizadaAdmin({
      nombreProducto,
      nombreGanador
    });

    await transporter.sendMail({
      from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
      to: 'danielsagua.n@gmail.com',
      subject,
      html
    });
  }
}




const productoController = {

  listarActivos: async (req, res) => {
    try {
      const pool = await db;

      // ⏰ 1) Buscar subastas vencidas (fin = 20:00 del día siguiente a la publicación)
      const vencidas = await pool.request().query(`
      SELECT id_producto
      FROM Productos
      WHERE finalizada = 0
        AND GETDATE() >= DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(fecha_publicacion_producto AS date)) AS datetime))
    `);

      // 2) Cerrar y notificar cada una
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      for (const row of vencidas.recordset) {
        await cerrarSubastaYNotificar(pool, baseUrl, row.id_producto);
      }

      // 3) Listar activos con fecha_fin calculada (20:00 del día siguiente) y remaining_seconds
      const result = await pool.request().query(`
      SELECT 
        p.*,
        (SELECT MAX(monto_oferta) FROM Ofertas WHERE id_producto = p.id_producto) AS oferta_maxima,
        fecha_fin = DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(p.fecha_publicacion_producto AS date)) AS datetime)),
        remaining_seconds = DATEDIFF(
          SECOND, 
          GETDATE(),
          DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(p.fecha_publicacion_producto AS date)) AS datetime))
        )
      FROM Productos p
      WHERE p.finalizada = 0
      ORDER BY p.fecha_publicacion_producto DESC
    `);

      return res.json(result.recordset);
    } catch (error) {
      console.error('Error al listar productos activos:', error);
      if (!res.headersSent) return res.status(500).json({ message: 'Error al obtener productos activos' });
    }
  },


  // Comentado el 09102025
  // listarActivos: async (req, res) => {
  //   try {
  //     const pool = await db;

  //     // Buscar subastas vencidas según .env que aún no estén finalizadas
  //     const vencidas = await pool.request()
  //       .input('duracion', sql.Int, DURACION_MIN)
  //       .query(`
  //       SELECT id_producto
  //       FROM Productos
  //       WHERE finalizada = 0
  //         AND DATEADD(MINUTE, @duracion, fecha_publicacion_producto) <= GETDATE()
  //     `);

  //     // Cerrar y notificar cada una
  //     const baseUrl = `${req.protocol}://${req.get('host')}`;
  //     // Cerrar y notificar cada una
  //     for (const row of vencidas.recordset) {
  //       await cerrarSubastaYNotificar(pool, baseUrl, row.id_producto);
  //     }


  //     // Listar activos con datos para el contador del front
  //     const result = await pool.request()
  //       .input('duracion', sql.Int, DURACION_MIN)
  //       .query(`
  //       SELECT 
  //         p.*,
  //         (SELECT MAX(monto_oferta) FROM Ofertas WHERE id_producto = p.id_producto) AS oferta_maxima,
  //         @duracion AS duracion_min,
  //         DATEADD(MINUTE, @duracion, p.fecha_publicacion_producto) AS fecha_fin,
  //         DATEDIFF(SECOND, GETDATE(), DATEADD(MINUTE, @duracion, p.fecha_publicacion_producto)) AS remaining_seconds
  //       FROM Productos p
  //       WHERE p.finalizada = 0
  //       ORDER BY p.fecha_publicacion_producto DESC
  //     `);

  //     return res.json(result.recordset);
  //   } catch (error) {
  //     console.error('Error al listar productos activos:', error);
  //     if (!res.headersSent) return res.status(500).json({ message: 'Error al obtener productos activos' });
  //   }
  // },


  listarTodos: async (req, res) => {
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
      console.error('Error al listar todos los productos:', error);
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
    SELECT 
      p.*,
      fecha_fin = DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(p.fecha_publicacion_producto AS date)) AS datetime)),
      remaining_seconds = DATEDIFF(
        SECOND, 
        GETDATE(),
        DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(p.fecha_publicacion_producto AS date)) AS datetime))
      )
    FROM Productos p
    WHERE p.id_producto = @id
  `);

      // comentado el 09102025
      // const result = await pool.request()
      //   .input('id', sql.Int, id)
      //   .input('duracion', sql.Int, DURACION_MIN)
      //   .query(`
      //   SELECT 
      //     p.*,
      //     @duracion AS duracion_min,
      //     DATEADD(MINUTE, @duracion, p.fecha_publicacion_producto) AS fecha_fin,
      //     DATEDIFF(SECOND, GETDATE(), DATEADD(MINUTE, @duracion, p.fecha_publicacion_producto)) AS remaining_seconds
      //   FROM Productos p
      //   WHERE p.id_producto = @id
      // `);

      const producto = result.recordset[0];
      if (!producto) {
        return res.status(404).json({ message: 'Producto no encontrado' }); // ⬅️ return
      }

      return res.json(producto); // ⬅️ return
    } catch (error) {
      console.error('Error al obtener producto:', error);
      if (!res.headersSent) {
        return res.status(500).json({ message: 'Error al obtener producto' }); // ⬅️ return
      }
      // si ya se envió, no hagas nada más
    }
  },

  // verProducto: async (req, res) => {
  //   const { id } = req.params;
  //   try {
  //     const pool = await db;
  //     // const result = await pool.request()
  //     //   .input('id', sql.Int, id)
  //     //   .query('SELECT * FROM Productos WHERE id_producto = @id');
  //     const result = await pool.request()
  //       .input('id', sql.Int, id)
  //       .query('SELECT * FROM Productos WHERE id_producto = @id');
  //     res.json(result.recordset[0]);
  //     res.json(result.recordset[0]);
  //   } catch (error) {
  //     console.error('Error al obtener producto:', error);
  //     res.status(500).json({ message: 'Error al obtener producto' });
  //   }
  // },

  crearProducto: async (req, res) => {
    const { nombre, descripcion, precio } = req.body;

    const archivos = req.files || [];
    const imagenes = archivos.map(f => f.filename);

    const imagen = imagenes[0] || 'test.webp';
    const imagen1 = imagenes[1] || null;
    const imagen2 = imagenes[2] || null;
    const imagen3 = imagenes[3] || null;
    const imagen4 = imagenes[4] || null;

    try {
      const pool = await db;
      const insertResult = await pool.request()
        .input('nombre', sql.NVarChar, nombre)
        .input('descripcion', sql.NVarChar, descripcion)
        .input('precio', sql.Decimal(10, 2), precio)
        .input('imagen', sql.NVarChar, imagen)
        .input('imagen1', sql.NVarChar, imagen1)
        .input('imagen2', sql.NVarChar, imagen2)
        .input('imagen3', sql.NVarChar, imagen3)
        .input('imagen4', sql.NVarChar, imagen4)
        .input('imagen_destacada', sql.NVarChar, req.body.imagen_destacada || imagen)
        .query(`
          INSERT INTO Productos (nombre_producto, descripcion_producto, precio_producto, imagen, imagen1, imagen2, imagen3, imagen4, imagen_destacada)
          VALUES (@nombre, @descripcion, @precio, @imagen, @imagen1, @imagen2, @imagen3, @imagen4, @imagen_destacada);
          SELECT SCOPE_IDENTITY() AS id_producto;
        `);

      const idProducto = insertResult.recordset?.[0]?.id_producto || insertResult.recordset?.[0]?.ID || null;

      if (process.env.AVISO_PRODUCTO_NUEVO === 'true') {
        const usuariosResult = await pool.request().query(`
          SELECT correo, nombre_usuario FROM Usuarios WHERE estado = 1
        `);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const urlProducto = `${baseUrl}/producto.html?id=${idProducto}`;
        const nombreProducto = nombre;

        for (const usuario of usuariosResult.recordset) {
          if (ENVIAR_CORREOS) {
            const { subject, html } = tplNuevoProducto({
              nombreUsuario: usuario.nombre_usuario,
              nombreProducto,
              urlProducto
            });

            await transporter.sendMail({
              from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
              to: usuario.correo,
              subject,
              html
            });
          }
        }
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
        .input('precio', sql.Decimal(10, 2), precio)
        .input('imagen_destacada', sql.NVarChar, req.body.imagen_destacada);

      if (imagenNueva) {
        request.input('imagen', sql.NVarChar, imagenNueva);
        await request.query(`
          UPDATE Productos
          SET nombre_producto = @nombre,
              descripcion_producto = @descripcion,
              precio_producto = @precio,
              imagen = @imagen,
              imagen_destacada = @imagen_destacada
          WHERE id_producto = @id
        `);
      } else {
        await request.query(`
          UPDATE Productos
          SET nombre_producto = @nombre,
              descripcion_producto = @descripcion,
              precio_producto = @precio,
              imagen_destacada = @imagen_destacada
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
        .query('SELECT imagen, nombre_producto FROM Productos WHERE id_producto = @id');
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
        if (ENVIAR_CORREOS) {
          const { subject, html } = tplSubastaCancelada({
            nombreUsuario: usuario.nombre_usuario,
            nombreProducto: result.recordset[0].nombre_producto
          });
          await transporter.sendMail({
            from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
            to: usuario.correo,
            subject,
            html
          });
        }
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
      const prodRes = await pool.request()
        .input('id_producto', sql.Int, id_producto)
        .query(`
    SELECT 
      nombre_producto,
      precio_producto,
      fecha_publicacion_producto,
      finalizada,
      fecha_fin = DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(fecha_publicacion_producto AS date)) AS datetime)),
      expirada = CASE 
        WHEN GETDATE() >= DATEADD(HOUR, 20, CAST(DATEADD(DAY, 1, CAST(fecha_publicacion_producto AS date)) AS datetime)) THEN 1 
        ELSE 0 
      END
    FROM Productos
    WHERE id_producto = @id_producto
  `);



      // ✅ Validación de tiempo en SQL con minutos desde .env 09102025
      // const prodRes = await pool.request()
      //   .input('id_producto', sql.Int, id_producto)
      //   .input('duracion', sql.Int, DURACION_MIN)
      //   .query(`
      //     SELECT 
      //       nombre_producto,
      //       precio_producto,
      //       fecha_publicacion_producto,
      //       finalizada,
      //       expirada = CASE 
      //         WHEN DATEADD(MINUTE, @duracion, fecha_publicacion_producto) <= GETDATE() THEN 1 
      //         ELSE 0 
      //       END
      //     FROM Productos
      //     WHERE id_producto = @id_producto
      //   `);

      const producto = prodRes.recordset[0];
      if (!producto) return res.status(404).json({ message: 'Producto no encontrado' });
      if (producto.finalizada === 1 || producto.expirada === 1) {
        return res.status(400).json({ message: 'La subasta ha finalizado' });
      }

      // ✅ Oferta más alta actual (antes de insertar)
      const anteriorResult = await pool.request()
        .input('id_producto', sql.Int, id_producto)
        .query(`
          SELECT TOP 1 o.id_usuario, u.correo, u.nombre_usuario, o.monto_oferta
          FROM Ofertas o
          JOIN Usuarios u ON u.id_usuario = o.id_usuario
          WHERE o.id_producto = @id_producto
          ORDER BY o.monto_oferta DESC
        `);

      // 🧠 Bloquear si el usuario actual ya tiene la oferta más alta
      const anteriorUsuario = anteriorResult.recordset[0];
      if (anteriorUsuario && anteriorUsuario.id_usuario === id_usuario) {
        return res.status(400).json({
          message: 'La oferta más alta ya es tuya. No puedes ofertar nuevamente hasta que otro usuario te supere.'
        });
      }

      const ofertaMaxima = anteriorResult.recordset[0]?.monto_oferta || 0;

      // ✅ Reglas de incrementos en miles
      const montoNum = Math.trunc(Number(monto));
      if (!Number.isFinite(montoNum) || montoNum <= 0) {
        return res.status(400).json({ message: 'Monto inválido.' });
      }
      if (montoNum % 1000 !== 0) {
        return res.status(400).json({ message: 'Las ofertas deben ser en múltiplos de $1.000.' });
      }

      const minRequerido = (ofertaMaxima > 0 ? Number(ofertaMaxima) : Number(producto.precio_producto)) + 1000;
      if (montoNum < minRequerido) {
        return res.status(400).json({
          message: `Debes ofertar al menos $${minRequerido.toLocaleString()}.`
        });
      }


      // const anteriorUsuario = anteriorResult.recordset[0];

      // Insertar nueva oferta
      await pool.request()
        .input('id_usuario', sql.Int, id_usuario)
        .input('id_producto', sql.Int, id_producto)
        .input('monto', sql.Decimal(10, 2), monto)
        .query(`
          INSERT INTO Ofertas (id_usuario, id_producto, monto_oferta)
          VALUES (@id_usuario, @id_producto, @monto)
        `);

      // Datos del ofertante actual
      const userResult = await pool.request()
        .input('id_usuario', sql.Int, id_usuario)
        .query('SELECT nombre_usuario, correo FROM Usuarios WHERE id_usuario = @id_usuario');
      const usuario = userResult.recordset[0];

      // 📧 Correo: oferta registrada
      if (ENVIAR_CORREOS) {
        const nombreProducto = producto.nombre_producto;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const urlProducto = `${baseUrl}/producto.html?id=${id_producto}`;

        const { subject, html } = tplOfertaRegistrada({
          nombreUsuario: usuario.nombre_usuario,
          monto,
          nombreProducto,
          urlProducto
        });

        await transporter.sendMail({
          from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
          to: usuario.correo,
          subject,
          html
        });
      }

      // 📧 Correo: has sido superado (si corresponde)
      if (anteriorUsuario && anteriorUsuario.id_usuario !== id_usuario) {
        if (ENVIAR_CORREOS) {
          const nombreProducto = producto.nombre_producto;
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const urlProducto = `${baseUrl}/producto.html?id=${id_producto}`;

          const { subject, html } = tplHasSidoSuperado({
            nombreUsuario: anteriorUsuario.nombre_usuario,
            nombreProducto,
            urlProducto
          });

          await transporter.sendMail({
            from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
            to: anteriorUsuario.correo,
            subject,
            html
          });
        }
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
        .query('SELECT finalizada, nombre_producto FROM Productos WHERE id_producto = @id');
      const ya = check.recordset[0];
      if (ya?.finalizada === true || ya?.finalizada === 1) {
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
      const nombreProducto = ya?.nombre_producto;

      await pool.request()
        .input('id', sql.Int, id)
        .input('ganador', sql.Int, ganador)
        .query(`
          UPDATE Productos
          SET finalizada = 1, ganador_id = @ganador
          WHERE id_producto = @id
        `);

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const urlProducto = `${baseUrl}/producto.html?id=${id}`;

      if (ganador) {
        const usuario = await pool.request()
          .input('id_usuario', sql.Int, ganador)
          .query('SELECT nombre_usuario, correo FROM Usuarios WHERE id_usuario = @id_usuario');

        if (ENVIAR_CORREOS) {
          const { subject, html } = tplGanasteSubasta({
            nombreUsuario: usuario.recordset[0].nombre_usuario,
            nombreProducto,
            urlProducto
          });
          await transporter.sendMail({
            from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
            to: usuario.recordset[0].correo,
            subject,
            html
          });
        }
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
        if (ENVIAR_CORREOS) {
          const { subject, html } = tplSubastaFinalizadaParaParticipante({
            nombreUsuario: usuario.nombre_usuario,
            nombreProducto,
            urlProducto
          });
          await transporter.sendMail({
            from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
            to: usuario.correo,
            subject,
            html
          });
        }
      }

      if (ENVIAR_CORREOS) {
        let nombreGanador = null;
        if (ganador) {
          const u2 = await pool.request()
            .input('id_usuario', sql.Int, ganador)
            .query('SELECT nombre_usuario FROM Usuarios WHERE id_usuario = @id_usuario');
          nombreGanador = u2.recordset[0]?.nombre_usuario || null;
        }

        const { subject, html } = tplSubastaFinalizadaAdmin({
          nombreProducto,
          nombreGanador
        });
        await transporter.sendMail({
          from: `"Subastas Internas" <${process.env.EMAIL_USER}>`,
          to: 'danielsagua.n@gmail.com',
          subject,
          html
        });
      }


      res.json({ message: 'Subasta finalizada' });
    } catch (error) {
      console.error('Error al finalizar subasta:', error);
      res.status(500).json({ message: 'Error al finalizar subasta' });
    }
  }
};

module.exports = {
  ...productoController,
  upload,
  cerrarSubastaYNotificar
};
