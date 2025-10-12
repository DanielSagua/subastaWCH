const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const { upload } = require('../controllers/productoController');
const { isAdmin, isAuthenticated } = require('../middlewares/authMiddleware');
const { listarOfertasPorProducto } = require('../controllers/productoController');


// Rutas públicas / protegidas para usuarios
// Solo productos activos (para home)
router.get('/productos/activos', productoController.listarActivos);

router.get('/producto/:id/ofertas', productoController.listarOfertasPorProducto);


// Todos los productos (para gestión)
router.get('/productos', productoController.listarTodos);

router.get('/producto/:id', productoController.verProducto);
router.post('/producto/:id_producto/ofertar', isAuthenticated, productoController.ofertar);

// Rutas para administradores
router.post('/productos', isAdmin, upload.array('imagenes', 5), productoController.crearProducto);
router.post('/productos/:id', isAdmin, upload.array('imagenes', 5), productoController.editarProducto);
router.delete('/productos/:id', isAdmin, productoController.eliminarProducto);
router.post('/productos/:id', isAdmin, upload.array('imagenes', 5), productoController.editarProducto);
router.post('/productos/:id/finalizar', isAdmin, productoController.finalizarSubasta);



module.exports = router;


