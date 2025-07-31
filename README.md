
# 🛍️ Subastas Internas - Aplicación Web

Sistema web de subastas internas de productos en desuso para una empresa. Cada empleado puede ofertar por productos publicados por un administrador.

---

## ⚙️ Tecnologías utilizadas

- Node.js + Express
- HTML5, CSS3, Bootstrap 5.3
- JavaScript (cliente y servidor)
- SQL Server
- Multer (carga de imágenes)
- Bcryptjs (encriptación de contraseñas)
- Nodemailer (recuperación por correo)
- Express-session + Connect-flash (sesiones y mensajes)
- Dotenv (variables de entorno)

---

## 📁 Estructura del proyecto

```
subastas-app/
├── app.js
├── .env
├── /controllers
│   └── authController.js
│   └── productoController.js
│   └── usuarioController.js
├── /routes
│   └── auth.js
│   └── productos.js
│   └── usuarios.js
├── /views
│   └── *.html (vistas del sistema)
├── /public
│   ├── /uploads (imágenes)
│   ├── /css
│   ├── /js
├── /db
│   └── sql.js
```

---

## 🔐 Funcionalidades

### 🔒 Autenticación
- Login con correo y contraseña
- Contraseñas encriptadas (bcrypt)
- Recuperación de contraseña por correo electrónico
- Cambio de contraseña seguro vía token

### 👤 Roles
- Usuario: puede ver productos y ofertar
- Administrador: puede gestionar usuarios y productos

### 📦 Productos
- Crear, editar y eliminar productos
- Subir imagen por producto (opcional)
- Vista previa de imagen
- Eliminación automática de la imagen al editar o borrar el producto
- Registro de ofertas por usuario
- Visualización de la oferta máxima

---

## ⚠️ Requisitos previos

- Node.js v16+ y npm
- SQL Server (local o remoto)
- Configurar archivo `.env`

### 📄 Ejemplo `.env`:

```env
DB_USER=Usuario de BD
DB_PASSWORD=tu_password
DB_SERVER=localhost
DB_DATABASE=SubastasDB
DB_ENCRYPT=false

EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=clave_aplicacion_gmail
JWT_SECRET=una_clave_segura
```

---

## 🚀 Instalación y ejecución

```bash
# Clona el proyecto
git clone https://github.com/tuusuario/subastas-app.git
cd subastas-app

# Instala dependencias
npm install

# Inicia el servidor
node app.js
```

Accede en tu navegador a:

```
http://localhost:3000/login.html
```

---

## 🛠 Scripts útiles

- `node app.js` → ejecuta el servidor

---



---

## 📌 Notas adicionales

- Todas las imágenes se guardan en `/public/uploads/`.
- Las vistas están protegidas por sesión y rol.
- No se utilizan motores de plantillas, todo es HTML estático.

---

## 📃 Licencia

Este proyecto es de uso académico y privado. Puedes adaptarlo libremente para otros fines internos.
