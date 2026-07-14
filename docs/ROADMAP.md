# Roadmap de EcoHome Store

## Evolutivo 1 — Backend en tiempo real con Socket.IO
**Objetivo:** habilitar comunicación en tiempo real entre clientes conectados.

### Entregables
- Servidor Express integrado con Socket.IO
- Conexión y desconexión con logs claros
- Evento `new-message` desde clientes
- Broadcast con `io.emit('message-received', ...)`

### Criterios de aceptación
- Un mensaje enviado desde una pestaña o navegador aparece en otra en tiempo real
- El servidor muestra logs de conexión/desconexión
- El endpoint de prueba queda disponible en `/chat`

### Evidencia sugerida
- Captura de dos ventanas navegando a `/chat`
- Video corto o GIF mostrando el mensaje propagándose
- Logs del servidor mostrando los eventos

---

## Evolutivo 2 — Integración con catálogo y productos
**Objetivo:** hacer que los cambios de productos se reflejen en tiempo real para todos los clientes.

### Entregables
- Eventos de creación, actualización y eliminación de productos
- Broadcasting a clientes conectados al cambiar datos
- Notificaciones de estado para el panel del usuario

---

## Evolutivo 3 — Seguridad y roles
**Objetivo:** proteger el acceso a operaciones sensibles y reforzar la experiencia del usuario.

### Entregables
- JWT en rutas protegidas
- Roles admin/client
- Validación de permisos en operaciones críticas

---

## Evolutivo 4 — Frontend y experiencia de usuario
**Objetivo:** convertir la API en una aplicación usable y visualmente completa.

### Entregables
- Frontend web simple para ver productos y chat en tiempo real
- Formularios para login, registro y gestión de productos
- Diseño básico y navegación clara

---

## Ruta de trabajo recomendada
1. Completar la actividad 1 y dejar evidencia de Socket.IO
2. Integrar eventos de productos en tiempo real
3. Consolidar seguridad y roles
4. Añadir un frontend mínimo para consumo real
5. Preparar repositorio en GitHub, versionado y README final
