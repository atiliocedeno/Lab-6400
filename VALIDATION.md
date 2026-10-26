# Validación 1.1 — 26 octubre 2026

- SDK 58, React 19.3.0, React Native 0.88.0.
- `npm test`: pruebas antiguas y nuevas aprobadas. Dispositivos simulados; no se contactó una cámara real.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npx expo export --platform ios --platform android`: ambos bundles generados.
- `npx expo config --type introspect --json`: resuelto. Comprobados entitlement multicast, descripción de red local y manifest Android HTTP.
- Expo Doctor: **19/20**. Advierte que `react-native-udp` está marcado como no mantenido en React Native Directory. No se ocultó la advertencia. Compatibilidad nativa con RN 0.88 pendiente de compilación y prueba física.
- `npx expo whoami`: sin sesión. No se inició una compilación EAS ni se generó un IPA/APK.

## Casos cubiertos

SSDP con puerto/ruta dinámicos, deduplicación, cancelación y cierre de socket; rechazo de host distinto, IP pública, XML malformado/DOCTYPE, modelo distinto y falta de servicio camera; consulta de capacidades; validación de opciones; correlación de IDs JSON-RPC; errores HTTP/JSON; timeout y cancelación de fetch; ausencia de setters; lectura posterior que no confirma el ajuste; receta parcialmente aplicada e interrupción; EV tercios/medios sin redondeo; WB fuera de rango; ninguna escritura después de cerrar sesión; captura sin reintentos.

## No demostrado

- Descubrimiento y control real en A6400 o distintos firmwares.
- Compilación del módulo nativo y comportamiento físico en iOS/Android.
- Entitlement autorizado por Apple/perfil de firma.
- Aplicación completa de recetas. Estilo, contraste, saturación, nitidez, ajuste fino y DRO permanecen manuales.

La ausencia de credenciales de firma y de hardware impide declarar la app funcional de extremo a extremo. El código es revisable y comprobable por software, pero la entrega nativa y validación física siguen abiertas.
