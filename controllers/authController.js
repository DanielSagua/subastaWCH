const sql = require('mssql');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const db = require('../db/sql');
const BASE_URL = process.env.BASE_URL || `https://${process.env.HOSTNAME || 'subastaswch.wch-ops.cl'}`;


// Secret para recuperar contraseña
const JWT_SECRET = process.env.JWT_SECRET || 'clave_secreta_para_tokens';

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

// Remitente y SMTP desde .env (hosting)
const FROM = process.env.EMAIL_FROM || `"Subastas WCH" <${process.env.SMTP_USER}>`;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,                     // p.ej. webmail.wch-ops.cl
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true', // true=465, false=587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// (Opcional) Verificación en logs del servidor
transporter.verify((err) => {
  if (err) console.error('[SMTP][authController] ❌', err.message);
  else console.log('[SMTP][authController] ✅ Conexión OK');
});



// helper (colócalo arriba en authController.js)
function validarPassword(pwd) {
  if (typeof pwd !== 'string') return 'Contraseña inválida';
  if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  // opcional: complejidad
  if (!/[A-Z]/.test(pwd)) return 'Debe tener al menos una mayúscula';
  if (!/[a-z]/.test(pwd)) return 'Debe tener al menos una minúscula';
  if (!/[0-9]/.test(pwd)) return 'Debe tener al menos un número';
  return null;
}


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

  // recuperarPassword: async (req, res) => {
  //   const { correo } = req.body;
  //   try {
  //     const pool = await db;
  //     const result = await pool.request()
  //       .input('correo', sql.NVarChar, correo)
  //       .query('SELECT * FROM Usuarios WHERE correo = @correo');

  //     const user = result.recordset[0];
  //     if (!user) return res.status(404).json({ message: 'Correo no encontrado' });

  //     const token = jwt.sign({ id: user.id_usuario }, JWT_SECRET, { expiresIn: '15m' });

  //     const transporter = nodemailer.createTransport({
  //       service: 'gmail',
  //       auth: {
  //         user: process.env.EMAIL_USER,
  //         pass: process.env.EMAIL_PASS
  //       }
  //     });

  //     const url = `http://${req.headers.host}/cambiar-password/${token}`;

  //     await transporter.sendMail({
  //       from: `"Subastas" <${process.env.EMAIL_USER}>`,
  //       to: correo,
  //       subject: 'Recuperación de contraseña en Subasta',
  //       html: `<p>Haz clic en el siguiente enlace para cambiar tu contraseña:</p>


  //             <p style="margin:16px 0;">
  //       <a href="${url}" 
  //          style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;border:1px solid #005387;">
  //         Cambia tu contraseña
  //       </a>
  //     </p><br>
  //     <p><i><b>- Este enlace expira en 10 minutos.<br>
  //     - Si no solicitaste cambiar tu contraseña omite este mensaje.</b></i></p>



  //             <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
  //     <small>Atentamente,<br>Equipo de WEG Subastas</small>
  //     `
  //     });

  //     res.json({ message: 'Correo enviado con instrucciones' });
  //   } catch (error) {
  //     console.error('Error enviando correo:', error);
  //     res.status(500).json({ message: 'Error al enviar correo' });
  //   }
  // },


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

      // Usa tu dominio BASE_URL en vez de req.headers.host (para https y dominio correcto)
      const url = `${BASE_URL}/cambiar-password/${token}`;

      await transporter.sendMail({
        from: FROM,                            // ⬅️ remitente del hosting
        to: correo,
        subject: 'Recuperación de contraseña en Subastas WCH',
        html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
          <p>Hola ${user.nombre_usuario || ''},</p>
          <p>Haz clic en el siguiente enlace para cambiar tu contraseña:</p>

          <p style="margin:16px 0;">
            <a href="${url}" 
               style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;border:1px solid #005387;">
              Cambiar contraseña
            </a>
          </p>

          <p style="color:#555;font-size:0.95em;">
            Este enlace expira en 15 minutos. Si no solicitaste cambiar tu contraseña, puedes ignorar este mensaje.
          </p>

          <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
          <small>Atentamente,<br>Equipo de WEG Subastas</small>
        </div>
      `
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

  cambiarPassword: async (req, res) => {
    const { token } = req.params;
    // acepta distintos nombres de campo por si el front envía otro
    const nuevaPassword =
      req.body.nuevaPassword ??
      req.body.nuevaContrasena ??
      req.body.passwordNueva ??
      req.body.password;

    // ✅ Validación básica
    if (!nuevaPassword) {
      return res.status(400).json({ message: 'Debes ingresar la nueva contraseña.' });
    }
    if (typeof nuevaPassword !== 'string' || nuevaPassword.length < 8) {
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 8 caracteres.'
      });
    }
    // Reglas opcionales de complejidad (puedes descomentar):
    if (!/[A-Z]/.test(nuevaPassword))
      return res.status(400).json({ message: 'Debe contener al menos una letra mayúscula.' });
    if (!/[a-z]/.test(nuevaPassword))
      return res.status(400).json({ message: 'Debe contener al menos una letra minúscula.' });
    if (!/[0-9]/.test(nuevaPassword))
      return res.status(400).json({ message: 'Debe contener al menos un número.' });

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
