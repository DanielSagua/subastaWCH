const sql = require('mssql');
const bcrypt = require('bcryptjs');
const db = require('../db/sql');

const usuarioController = {
  listarUsuarios: async (req, res) => {
    try {
      const pool = await db;
      const result = await pool.request().query('SELECT id_usuario, nombre_usuario, correo, tipo_usuario, estado FROM Usuarios');
      res.json(result.recordset);
    } catch (error) {
      console.error('Error al listar usuarios:', error);
      res.status(500).json({ message: 'Error al obtener usuarios' });
    }
  },

  obtenerUsuario: async (req, res) => {
    const { id } = req.params;
    try {
      const pool = await db;
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT id_usuario, nombre_usuario, correo, tipo_usuario, estado FROM Usuarios WHERE id_usuario = @id');
      res.json(result.recordset[0]);
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      res.status(500).json({ message: 'Error al obtener usuario' });
    }
  },

  agregarUsuario: async (req, res) => {
    const { nombre, correo, rut, password, tipo } = req.body;
    try {
      const hash = await bcrypt.hash(password, 10);
      const pool = await db;
      await pool.request()
        .input('nombre', sql.NVarChar, nombre)
        .input('correo', sql.NVarChar, correo)
        .input('rut', sql.VarChar, rut)
        .input('password', sql.NVarChar, hash)
        .input('tipo', sql.NVarChar, tipo)
        .query(`
          INSERT INTO Usuarios (nombre_usuario, correo, rut_usuario, password, tipo_usuario, estado)
          VALUES (@nombre, @correo, @rut, @password, @tipo, 1)
        `);
      res.json({ message: 'Usuario creado con éxito' });
    } catch (error) {
      console.error('Error al agregar usuario:', error);
      res.status(500).json({ message: 'Error al crear usuario' });
    }
  },

  editarUsuario: async (req, res) => {
    const { id } = req.params;
    const { nombre, tipo, estado } = req.body;
    try {
      const pool = await db;
      await pool.request()
        .input('id', sql.Int, id)
        .input('nombre', sql.NVarChar, nombre)
        .input('tipo', sql.NVarChar, tipo)
        .input('estado', sql.Bit, estado)
        .query(`
          UPDATE Usuarios
          SET nombre_usuario = @nombre,
              tipo_usuario = @tipo,
              estado = @estado
          WHERE id_usuario = @id
        `);
      res.json({ message: 'Usuario actualizado correctamente' });
    } catch (error) {
      console.error('Error al editar usuario:', error);
      res.status(500).json({ message: 'Error al actualizar usuario' });
    }
  }
};

module.exports = usuarioController;
