# EcoHome

EcoHome es una plataforma multiplataforma de gestión de productos y comunicación en tiempo real. Combina un backend en **Node.js/Express** con **PostgreSQL**, una aplicación **Web en React/Vite** y una aplicación **Móvil en Flutter**, ofreciendo sincronización bidireccional mediante **Socket.IO**, autenticación con **JWT** y gestión de catálogo.

---

## 🚀 Funcionalidades y Alcance Actual

### 🔐 Autenticación y Autorización
- Registro (`/auth/signup`) e inicio de sesión (`/auth/login`) con hash de contraseñas mediante `bcryptjs` y emisión de tokens **JWT**.
- Control de acceso por roles (`admin` para gestión completa del catálogo, `client` para consulta y chat).

### 📦 Catálogo de Productos (CRUD)
- Gestión de productos vinculados al usuario creador en PostgreSQL.
- Endpoints REST para crear, listar, actualizar y eliminar productos.

### 💬 Chat en Tiempo Real Multiplataforma (Web & Móvil)
- **Sincronización Bidireccional**: Los mensajes enviados desde la Web aparecen al instante en la App Móvil y viceversa.
- **Integración Híbrida (WebSocket + API REST)**: Si un cliente envía un mensaje vía HTTP (`POST /messages`), el backend lo guarda en la base de datos y emite el evento WebSocket `message-received` automáticamente a todos los clientes conectados.
- **Consulta de Mensajes Recientes**: La API REST (`GET /messages?limit=50`) y la conexión inicial de Socket.IO traen siempre los mensajes **más recientes** ordenados cronológicamente.
- **Auto-scroll inteligente (UX)**:
  - **Web (React)**: Desplazamiento automático al fondo mediante `useRef` y `scrollIntoView`.
  - **Móvil (Flutter)**: Desplazamiento automático animado (`ScrollController`) al enviar/recibir mensajes y al cambiar a la pestaña del chat.
- **Resiliencia de conexión**: Configuración de transportes negociados (`polling` y `websocket`), reconexión automática y deduplicación segura de mensajes por ID.

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express, Socket.IO, JWT, bcryptjs, pg (PostgreSQL Client).
- **Base de Datos**: PostgreSQL.
- **Frontend Web**: React, Vite, Socket.IO Client.
- **Aplicación Móvil**: Flutter, Dart, `socket_io_client`, `http`, `shared_preferences`.
- **Herramientas**: npm, nodemon, Flutter CLI.

---

## 📁 Estructura del Proyecto

```text
Ecohome/
├── src/                      # Backend Express & Socket.IO
│   ├── config/db.js          # Conexión a PostgreSQL
│   ├── middleware/auth.js    # Middleware de JWT y roles
│   ├── routes/
│   │   ├── auth.js           # Rutas de login/signup y perfil
│   │   ├── products.js       # Rutas CRUD de productos
│   │   └── messages.js       # Rutas REST de mensajes (con broadcast a Socket.IO)
│   └── server.js             # Punto de entrada del servidor HTTP y Socket.IO
├── frontend/                 # Aplicación Web (React + Vite)
│   ├── src/
│   │   ├── App.jsx           # Componente principal (Catálogo, Auth y Chat con auto-scroll)
│   │   └── App.css           # Estilos de la aplicación web
│   └── vite.config.js        # Configuración de Vite y proxy de desarrollo
├── mobile/                   # Aplicación Móvil (Flutter)
│   ├── lib/
│   │   └── main.dart         # Aplicación Flutter (Navegación, Catálogo y Chat con auto-scroll)
│   └── pubspec.yaml          # Dependencias de Flutter
├── db/
│   └── schema.sql            # Estructura SQL de la base de datos
└── README.md
```

---

## ⚙️ Configuración del Entorno

### 1. Variables de Entorno en el Backend
Crea el archivo `.env` en la raíz del proyecto a partir del archivo `.env.example`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ecohome_db
DB_USER=postgres
DB_PASS=postgres
JWT_SECRET=ecohome-super-secret-change-me
```

### 2. Variables de Entorno en el Frontend Web
Crea el archivo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

---

## 🗄️ Base de Datos (PostgreSQL)

1. Inicia el servicio de PostgreSQL.
2. Crea la base de datos:
   ```bash
   createdb ecohome_db
   ```
3. Ejecuta la inicialización de las tablas:
   ```bash
   npm run db:init
   ```

---

## ▶️ Cómo Ejecutar el Proyecto

### 1. Backend (Node.js + Express + Socket.IO)

```bash
npm install
npm start
```
El servidor escuchará en `http://localhost:3000`.

### 2. Frontend Web (React + Vite)

```bash
cd frontend
npm install
npm run dev
```
Accede desde tu navegador en `http://localhost:5173`.

### 3. Aplicación Móvil (Flutter)

```bash
cd mobile
flutter pub get
flutter run
```
> **Nota de red en móvil**: La app detecta automáticamente la plataforma:
> - **Emulador Android**: Conecta a `http://10.0.2.2:3000`.
> - **Navegador / Desktop**: Conecta a `http://localhost:3000`.
> - **Dispositivo Físico**: Asegúrate de cambiar `getApiBaseUrl()` en `mobile/lib/main.dart` a tu IP local de red (ej. `http://192.168.x.x:3000`).

---

## 📡 Comunicación e Integración de Datos

```
 +------------------+              +-------------------+              +-------------------+
 |  App Web (React) | <=========>  | Servidor Express  | <=========>  | App Móvil (Flutter|
 |  Socket.IO Client|  WebSocket   |   + Socket.IO     |  WebSocket   | socket_io_client  |
 +------------------+              +---------+---------+              +-------------------+
                                             |
                                        SQL  |
                                             v
                                   +-------------------+
                                   |    PostgreSQL     |
                                   +-------------------+
```

1. **Envío por WebSocket (`new-message`)**:
   - Tanto Web como Móvil emiten el evento `new-message`.
   - El servidor valida la sesión con el JWT, inserta en PostgreSQL y notifica a todos con `io.emit('message-received', savedMessage)`.

2. **Envío por API REST (`POST /messages`)**:
   - Se recibe el cuerpo `{ text: "..." }` con el header `Authorization: Bearer <token>`.
   - El backend guarda en la base de datos y ejecuta `req.app.get('io').emit('message-received', savedMessage)` para actualizar las vistas WebSocket en tiempo real.

3. **Carga Inicial de Mensajes (`GET /messages?limit=50`)**:
   - Devuelve los 50 mensajes más recientes en orden cronológico ascendente para renderizar la conversación correctamente desde el primer mensaje hasta el último.

---

## 🧾 Endpoints Principales de la API

| Método | Ruta | Descripción | Autenticación |
|---|---|---|---|
| `POST` | `/auth/signup` | Registro de usuario | No requerida |
| `POST` | `/auth/login` | Inicio de sesión (retorna JWT) | No requerida |
| `GET` | `/auth/me` | Perfil del usuario autenticado | Bearer JWT |
| `GET` | `/products` | Listar catálogo de productos | Bearer JWT |
| `POST` | `/products` | Crear un nuevo producto | Bearer JWT (Admin) |
| `GET` | `/messages?limit=50` | Historial de mensajes recientes | No requerida |
| `POST` | `/messages` | Crear mensaje (con broadcast Socket.IO) | Bearer JWT |

---

## 🔮 Próximas Mejoras

- Filtros por categoría y búsqueda de productos.
- Notificaciones push en la aplicación móvil.
- Paginación del historial de mensajes al deslizar hacia arriba.
### Autenticación
- POST /auth/signup
- POST /auth/login

### Productos
- GET /products
- GET /products/:id
- POST /products (solo admin)
- PUT /products/:id (solo admin)
- PATCH /products/:id (solo admin)
- DELETE /products/:id (solo admin)

### Mensajes
- GET /messages

## 🧪 Cómo probar cada funcionalidad

### 1. Registro y login

Prueba el flujo completo de registro e inicio de sesión desde la API o desde el frontend.

### 2. Gestión de productos

Usa el endpoint de productos para crear, actualizar, listar y eliminar productos. Solo los usuarios con rol admin pueden modificar datos.

### 3. Chat en tiempo real

Abre la ruta /chat en el navegador o usa la interfaz React para enviar mensajes en tiempo real.

### 4. Persistencia de mensajes

Los mensajes enviados desde el chat se almacenan en PostgreSQL y pueden consultarse desde /messages.

## 🧰 Archivos de ejemplo y pruebas

- docs/api-examples.sh: ejemplos de uso con cURL
- docs/EcoHome-API-Collection.json: colección para Postman o Insomnia
- docs/ROADMAP.md: plan de evolución del proyecto
