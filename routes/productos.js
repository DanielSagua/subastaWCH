const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const { upload } = require('../controllers/productoController');
const { isAdmin, isAuthenticated } = require('../middlewares/authMiddleware');

// Rutas públicas / protegidas para usuarios
router.get('/productos', productoController.listarProductos);
router.get('/producto/:id', productoController.verProducto);
router.post('/producto/:id_producto/ofertar', isAuthenticated, productoController.ofertar);

// Rutas para administradores
router.post('/productos', isAdmin, upload.single('imagen'), productoController.crearProducto);
router.post('/productos/:id', isAdmin, upload.single('imagen'), productoController.editarProducto);
router.delete('/productos/:id', isAdmin, productoController.eliminarProducto);
router.post('/productos/:id', isAdmin, upload.single('imagen'), productoController.editarProducto);
router.post('/productos/:id/finalizar', isAdmin, productoController.finalizarSubasta);



module.exports = router;


