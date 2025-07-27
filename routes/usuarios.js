const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const { isAdmin } = require('../middlewares/authMiddleware');

router.get('/usuarios', isAdmin, usuarioController.listarUsuarios);
router.get('/usuarios/:id', isAdmin, usuarioController.obtenerUsuario);
router.post('/usuarios', isAdmin, usuarioController.agregarUsuario);
router.put('/usuarios/:id', isAdmin, usuarioController.editarUsuario);

module.exports = router;
