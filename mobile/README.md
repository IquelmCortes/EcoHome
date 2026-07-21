# EcoHome Mobile

Aplicación Flutter para consumir el backend de EcoHome.

## Funcionalidades

- Login con JWT
- Listado de productos desde /products
- Chat en tiempo real con Socket.IO

## Requisitos

- Flutter SDK instalado y configurado
- Backend corriendo en http://10.0.2.2:3000

## Ejecutar

```bash
cd mobile
flutter pub get
flutter run
```

> En Android Emulator, 10.0.2.2 apunta al host donde está corriendo el backend.
