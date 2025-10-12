# ⚖️ Subastas WCH – Sistema de Subastas Internas

Aplicación web completa para la gestión de **subastas internas de productos en desuso** dentro de una empresa.  
Los colaboradores pueden ofertar en tiempo real, mientras los administradores gestionan productos, usuarios y el estado de las subastas.

---

## ⚙️ Tecnologías utilizadas

- **Node.js + Express**
- **HTML5, CSS3, Bootstrap 5.3**
- **JavaScript** (cliente y servidor)
- **SQL Server**
- **Multer** (carga de imágenes)
- **Bcryptjs** (encriptación de contraseñas)
- **Nodemailer** (envío de correos automáticos y recuperación de contraseñas)
- **Dotenv** (configuración por entorno)
- **Express-session** (control de sesiones y roles)
- **JWT** (para recuperación de contraseñas segura)
- **CORS** (opcional, para pruebas locales)
- **SetInterval Job interno** (control automático del cierre de subastas)

---

## 📁 Estructura del proyecto

```
subastaWCH/
├── app.js
├── .env
├── /controllers
│   ├── authController.js
│   ├── productoController.js
│   ├── usuarioController.js
│   └── emails/
│       └── builders.js
├── /routes
│   ├── auth.js
│   ├── productos.js
│   └── usuarios.js
├── /public
│   ├── /uploads/ (imágenes de productos)
│   ├── /css/
│   ├── /js/
│   ├── /images/ (favicon y logos)
│   └── *.html (vistas)
├── /db
│   └── sql.js
├── /emails
│   └── builders.js
└── README.md
```

---

## 🔐 Autenticación y seguridad

- Inicio de sesión con **correo y contraseña**.
- Contraseñas cifradas con **bcryptjs**.
- Recuperación de contraseña mediante **correo con token JWT**.
- Validación de **requisitos mínimos de contraseña**:
  - mínimo 8 caracteres  
  - opcional: letras mayúsculas, minúsculas y números
- Control de **sesiones y roles**:
  - Usuario: puede ver y ofertar.
  - Administrador: puede gestionar usuarios y productos.

---

## 📦 Funcionalidades

### 👤 Usuarios
- Alta, edición y baja lógica (estado activo/inactivo).
- Cambio y validación de contraseñas.
- Eliminación con confirmación y validación de dependencias.
- Solo los usuarios activos reciben correos automáticos.

### 🛍️ Productos
- Crear, editar y eliminar productos con múltiples imágenes.
- Subida de imágenes con **Multer**.
- Eliminación automática de imágenes antiguas.
- Ofertas mínimas en incrementos de **$1.000**.
- Prevención de ofertas duplicadas (si ya tienes la oferta más alta).
- Las descripciones usan un 70% del ancho del contenedor.

### ⏰ Subastas automáticas
- Cada subasta finaliza automáticamente **a las 20:00 del día siguiente** a su publicación.
- El cierre se maneja con un **setInterval interno en el servidor**.
- En el cierre se:
  - marca la subasta como finalizada,
  - determina el ganador,
  - envían correos automáticos (ganador, participantes, administrador).

### ✉️ Correos automáticos
- Nuevo producto publicado (solo a usuarios activos).
- Nueva oferta registrada.
- Aviso a ofertante superado.
- Subasta finalizada (ganador y participantes).
- Subasta cancelada.
- Todos los correos se controlan con `ENVIAR_CORREOS=true/false` en `.env`.

### 💼 Panel de administración
- Gestión de usuarios y productos.
- Visualización del **historial de ofertas por producto**.
- Ordenamiento de ofertas (más recientes primero) con paginación de 20 registros.
- Buscador en tiempo real (por nombre de producto o usuario).

---

## ⚙️ Variables de entorno

Ejemplo `.env`:

```env
# Base de datos
DB_USER=sa
DB_PASSWORD=tu_password
DB_SERVER=192.168.1.25
DB_DATABASE=subastaWCH
DB_ENCRYPT=false

# Correo
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=clave_aplicacion_gmail

# Configuración del sistema
ENVIAR_CORREOS=true
JWT_SECRET=clave_segura
SUBASTA_DURACION_MINUTOS=1440

# Horario de cierre automático
SUBASTA_HORA_CIERRE=20:00
```

---

## 🚀 Instalación y ejecución

```bash
# Clona el proyecto
git clone https://github.com/tuusuario/subastaWCH.git
cd subastaWCH

# Instala dependencias
npm install

# Inicia el servidor
node app.js
```

Luego abre en tu navegador:

```
http://localhost:3000/login.html
```

---

## 🛠️ Scripts útiles

| Comando              | Descripción |
|----------------------|-------------|
| `node app.js`        | Inicia el servidor |
| `npm install`        | Instala dependencias |
| `.env`               | Define parámetros de base de datos, correo y horarios |
| `public/uploads/`    | Carpeta para imágenes de productos |
| `public/images/`     | Logos y favicon |

---

## 💡 Notas adicionales

- Las vistas se sirven directamente desde **Express** (no se usa Live Server).
- Las rutas están protegidas según el rol del usuario.
- Las contraseñas nuevas se validan tanto en **frontend** como en **backend**.
- Todas las imágenes se eliminan del sistema al borrar o reemplazar un producto.
- Los usuarios inactivos **no reciben correos**.

---

## 📄 Licencia

Proyecto de uso **académico y privado**.  
Puede ser reutilizado con fines internos o educativos, mencionando la autoría original.

---

© 2025 — Desarrollado por **Daniel Sagua**
