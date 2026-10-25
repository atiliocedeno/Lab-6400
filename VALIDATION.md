# Validación de la entrega para Expo Go

## Aprobado

- Expo SDK 57.0.31, React 19.2.3, React Native 0.86.3.
- `npm ci`: instalación limpia desde el lockfile completada.
- `npx expo-doctor`: 21/21 comprobaciones aprobadas.
- `npx tsc --noEmit`: aprobado.
- `npx eslint .`: aprobado, sin errores ni advertencias.
- Exportación desde caché vacía: bundles iOS (589 módulos) y Android (587 módulos) generados.
- Dataset: 77 IDs únicos, 12 grupos, 6 recetas con efectos; regenerado desde fuente incluida.
- Guardado de favoritos protegido frente a escrituras simultáneas.
- Dependencia @expo/ngrok incluida y comando `npm run start:iphone` configurado.

## Pendiente

- Prueba externa de ngrok autorizada por el usuario: dos intentos terminaron con `ngrok tunnel took too long to connect`. No se confirmó un túnel operativo desde este entorno.
- Sin prueba de apertura, interacción o persistencia en teléfono físico.
- Sin validación de cámara, Bluetooth, Wi-Fi, USB ni procesamiento IA.
- La comprobación online `expo install --check` sufrió timeout de proxy. La comprobación con el mapa local de versiones indicó dependencias actualizadas; Expo Doctor aprobó todos sus checks.
