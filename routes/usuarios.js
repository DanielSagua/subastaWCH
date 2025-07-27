const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { isAdmin } = require('../middlewares/authMiddleware');

router.get('/usuarios', isAdmin, usuarioController.listarUsuarios);
router.get('/usuarios/:id', isAdmin, usuarioController.obtenerUsuario);
router.post('/usuarios', isAdmin, usuarioController.agregarUsuario);
router.put('/usuarios/:id', isAdmin, usuarioController.editarUsuario);

// Ruta pública para obtener al usuario autenticado
router.get('/usuario/perfil', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const { id, nombre, correo, tipo_usuario } = req.session.user;
  res.json({ id, nombre, correo, tipo_usuario });
});



module.exports = router;
