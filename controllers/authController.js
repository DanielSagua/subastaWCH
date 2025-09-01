const sql = require('mssql');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const db = require('../db/sql');

// Secret para recuperar contraseña
const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_para_tokens';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const authController = {
  login: async (req, res) => {
    const { correo, password } = req.body;

    try {
      const pool = await db;
      const result = await pool.request()
        .input('correo', sql.NVarChar, correo)
        .query('SELECT * FROM Usuarios WHERE correo = @correo AND estado = 1');

      const user = result.recordset[0];
      if (!user) return res.status(401).json({ message: 'Correo no registrado o usuario inactivo' });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(401).json({ message: 'Contraseña incorrecta' });

      req.session.user = {
        id: user.id_usuario,
        nombre: user.nombre_usuario,
        tipo: user.tipo_usuario
      };

      res.json({ success: true, tipo: user.tipo_usuario });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ message: 'Error interno en el servidor' });
    }
  },

  logout: (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
  },

  recuperarPassword: async (req, res) => {
    const { correo } = req.body;
    try {
      const pool = await db;
      const result = await pool.request()
        .input('correo', sql.NVarChar, correo)
        .query('SELECT * FROM Usuarios WHERE correo = @correo');

      const user = result.recordset[0];
      if (!user) return res.status(404).json({ message: 'Correo no encontrado' });

      const token = jwt.sign({ id: user.id_usuario }, JWT_SECRET, { expiresIn: '15m' });

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const url = `http://${req.headers.host}/cambiar-password/${token}`;

      await transporter.sendMail({
        from: `"Subastas" <${process.env.EMAIL_USER}>`,
        to: correo,
        subject: 'Recuperación de contraseña',
        html: `<p>Haz clic en el siguiente enlace para cambiar tu contraseña:</p><a href="${url}">${url}</a>`
      });

      res.json({ message: 'Correo enviado con instrucciones' });
    } catch (error) {
      console.error('Error enviando correo:', error);
      res.status(500).json({ message: 'Error al enviar correo' });
    }
  },

  mostrarFormularioCambio: (req, res) => {
    const { token } = req.params;
    try {
      jwt.verify(token, JWT_SECRET);
      res.sendFile('cambiar-password.html', { root: './views' });
    } catch {
      res.send('Token expirado o inválido');
    }
  },

  // cambiarPassword: async (req, res) => {
  //   const { token } = req.params;
  //   const { nuevaPassword } = req.body;

  //   try {
  //     const decoded = jwt.verify(token, JWT_SECRET);
  //     const hashed = await bcrypt.hash(nuevaPassword, 10);

  //     const pool = await db;
  //     await pool.request()
  //       .input('id', sql.Int, decoded.id)
  //       .input('password', sql.NVarChar, hashed)
  //       .query('UPDATE Usuarios SET password = @password WHERE id_usuario = @id');

  //     res.json({ message: 'Contraseña actualizada con éxito' });
  //   } catch (error) {
  //     console.error('Error al cambiar contraseña:', error);
  //     res.status(400).json({ message: 'Token inválido o expirado' });
  //   }
  // }

  // cambiarPassword: async (req, res) => {
  //   const { token } = req.query; // 👈 Si usas ?token= en la URL
  //   const { password } = req.body; // 👈 El nombre debe coincidir con el form

  //   try {
  //     const decoded = jwt.verify(token, JWT_SECRET);
  //     const hashed = await bcrypt.hash(password, 10);

  //     const pool = await db;
  //     await pool.request()
  //       .input('id', sql.Int, decoded.id)
  //       .input('password', sql.NVarChar, hashed)
  //       .query('UPDATE Usuarios SET password = @password WHERE id_usuario = @id');

  //     res.json({ message: 'Contraseña actualizada con éxito' });
  //   } catch (error) {
  //     console.error('Error al cambiar contraseña:', error);
  //     res.status(400).json({ message: 'Token inválido o expirado' });
  //   }
  // }

  // cambiarPassword: async (req, res) => {
  //   const { token } = req.params; // 👈 CAMBIADO: antes usaba req.query
  //   const { password } = req.body;

  //   try {
  //     const decoded = jwt.verify(token, JWT_SECRET);
  //     const hashed = await bcrypt.hash(password, 10);

  //     const pool = await db;
  //     await pool.request()
  //       .input('id', sql.Int, decoded.id)
  //       .input('password', sql.NVarChar, hashed)
  //       .query('UPDATE Usuarios SET password = @password WHERE id_usuario = @id');

  //     res.json({ message: 'Contraseña actualizada con éxito' });
  //   } catch (error) {
  //     console.error('Error al cambiar contraseña:', error);
  //     res.status(400).json({ message: 'Token inválido o expirado' });
  //   }
  // }

  cambiarPassword: async (req, res) => {
    const { token } = req.params;
    const { nuevaPassword } = req.body;


    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const hashed = await bcrypt.hash(nuevaPassword, 10);

      const pool = await db;
      await pool.request()
        .input('id', sql.Int, decoded.id)
        .input('password', sql.NVarChar, hashed)
        .query('UPDATE Usuarios SET password = @password WHERE id_usuario = @id');

      res.json({ message: 'Contraseña actualizada con éxito' });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      res.status(400).json({ message: 'Token inválido o expirado' });
    }
  }



};

module.exports = authController;
