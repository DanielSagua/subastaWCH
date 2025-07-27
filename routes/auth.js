const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login y logout
router.post('/login', authController.login);
router.get('/logout', authController.logout);

// Recuperación de contraseña
router.post('/recuperar-password', authController.recuperarPassword);
router.get('/cambiar-password/:token', authController.mostrarFormularioCambio);
router.post('/cambiar-password/:token', authController.cambiarPassword);

module.exports = router;