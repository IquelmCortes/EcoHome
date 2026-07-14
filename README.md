# EcoHome Store Backend

Backend REST para EcoHome Store orientado a la actividad 3 de CRUD de productos y consumo multiplataforma.

## Qué incluye
- PostgreSQL local
- Autenticación con JWT
- Roles admin/cliente
- CRUD completo de productos con protección por permisos
- Respuestas HTTP estándar para consumo web, móvil o desktop

## Requisitos
- Node.js 18+
- PostgreSQL instalado y ejecutándose localmente
- npm

## Actividad 1 - Backend en tiempo real con Socket.IO
Se integró Socket.IO al servidor Express para habilitar comunicación en tiempo real entre clientes conectados.

### Qué incluye
- Inicialización del servidor HTTP + WebSocket con Socket.IO
- Logs claros en conexión y desconexión
- Evento `new-message` para recibir mensajes desde clientes
- Broadcast con `io.emit('message-received', ...)` para reenviar a todos los clientes conectados

### Cómo probarlo
1. Instala dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor:
   ```bash
   npm start
   ```
3. Abre dos ventanas del navegador en:
   ```text
   http://localhost:3000/chat
   ```
4. Envía un mensaje desde una ventana y observarás que aparece en la otra en tiempo real.

## Actividad 2 - Seguridad y persistencia con JWT + base de datos
Se añadió autenticación real para el chat mediante JWT en la conexión WebSocket y persistencia de mensajes en PostgreSQL.

### Qué incluye
- Validación del JWT en el handshake de Socket.IO
- Asociación del socket con el usuario autenticado
- Tabla `messages` en la base de datos
- Guardado automático de cada mensaje antes de reenviarlo
- Endpoint `GET /messages` para verificar los mensajes almacenados

### Cómo probarlo
1. Inicia el servidor:
   ```bash
   npm start
   ```
2. Abre la página:
   ```text
   http://localhost:3000/chat
   ```
3. Inicia sesión con un usuario registrado o crea uno mediante `POST /auth/signup`.
4. Envía mensajes desde el chat; se guardarán automáticamente en la base de datos.
5. Abre `http://localhost:3000/messages` para ver los mensajes almacenados.

## Configuración local
1. Instala y levanta PostgreSQL en tu equipo.
2. Crea la base de datos que usarás, por ejemplo:
   ```bash
   createdb ecohome_db
   ```
   Si prefieres, puedes crearla desde pgAdmin o desde la consola de PostgreSQL.
3. Copia el archivo .env.example a .env y ajusta los valores si es necesario:
   ```bash
   copy .env.example .env
   ```
   Ejemplo de configuración:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=ecohome_db
   DB_USER=postgres
   DB_PASS=postgres
   JWT_SECRET=change-this-secret
   ```
4. Instala las dependencias:
   ```bash
   npm install
   ```
5. Crea las tablas y la base de datos si aún no existen:
   ```bash
   npm run db:init
   ```
6. Inicia el servidor:
   ```bash
   npm start
   ```

El backend quedará disponible en http://localhost:3000.

## Estructura del proyecto
- src/server.js: punto de entrada del servidor
- src/routes/auth.js: registro y login
- src/routes/products.js: CRUD de productos
- src/middleware/auth.js: validación de JWT y control de roles
- db/schema.sql: esquema de base de datos

## Endpoints principales
### Autenticación
- POST /auth/signup: crea un usuario nuevo
- POST /auth/login: valida credenciales y devuelve un JWT

### Productos
- GET /products: devuelve todos los productos
- GET /products/:id: devuelve un producto por id
- POST /products: crea un producto (requiere token y rol admin)
- PUT /products/:id: actualiza un producto (requiere token y rol admin)
- PATCH /products/:id: actualiza parcialmente un producto (requiere token y rol admin)
- DELETE /products/:id: elimina un producto (requiere token y rol admin)

## Validaciones y respuestas esperadas
- name y price deben ser válidos para crear o actualizar productos.
- price debe ser numérico y mayor que 0.
- Códigos HTTP esperados:
  - 200 OK
  - 201 Created
  - 400 Bad Request
  - 401 Unauthorized
  - 403 Forbidden
  - 404 Not Found

## Pruebas con Insomnia / Postman
1. Importa la colección de pruebas desde docs/EcoHome API.postman_collection.json.
2. Asegúrate de que el servidor esté corriendo en http://localhost:3000.
3. Ejecuta primero signup, luego login.
4. Usa el token devuelto por login en el header Authorization como:
   ```http
   Authorization: Bearer <token>
   ```
5. Prueba luego las operaciones CRUD de productos, incluyendo el caso sin token para comprobar que el middleware bloquea el acceso.

## Ejemplo de uso con cURL
Revisa el archivo docs/api-examples.sh para un flujo completo de signup, login, CRUD y errores.
