# Sony Recipe AI

App React Native / Expo SDK 58 para iPhone y Android. Catálogo de 77 recetas, favoritos locales y control remoto condicionado a las capacidades que anuncie una Sony ILCE-6400/ILCE-6400A.

**Estado:** código y pruebas de protocolo implementados; todavía no hay una compilación nativa firmada ni validación física del control remoto. No se garantiza compatibilidad con todos los firmwares A6400. No se aplica automáticamente el look completo de Recipe Lab.

## Funciones

- Catálogo original, búsqueda, filtros y favoritos persistentes.
- Guía manual completa de cada receta.
- Descubrimiento SSDP: obtiene la dirección real del servicio, valida fabricante y modelo. Sin IP ni puerto introducidos por el usuario.
- Sesión ScalarWebAPI e inicio de modo remoto si la cámara lo anuncia.
- ISO, apertura, velocidad y modo foto/vídeo solo con los valores ofrecidos por la cámara.
- Captura de fotografía, sin reintentos automáticos que puedan duplicar disparos.
- Aplicación **parcial** de receta: balance de blancos y compensación de exposición cuando estén disponibles; lectura posterior para verificar cada cambio.
- Informe de ajustes pendientes y de errores parciales. Nunca envía IDs internos de A6000 a la A6400.

## App instalada para conexión a cámara

Expo Go no contiene el módulo UDP que necesita el descubrimiento. La pestaña Cámara explica esa limitación en lugar de ofrecer una prueba que no puede realizar.

```bash
npm ci
npm run build:iphone
# o Android
npm run build:android
```

`eas.json` incluye `preview`, una app con el bundle incorporado que funciona sin Metro ni internet una vez instalada. La cámara sigue necesitando su Wi-Fi y permiso de red local. El perfil `development` sirve para desarrollar con `npm run start:device` y sí usa Metro.

Para compilar y distribuir en iPhone se necesitan sesión Expo/EAS, identidad de proyecto, cuenta Apple Developer y dispositivo registrado para distribución interna. El descubrimiento multicast requiere además el entitlement de Apple `com.apple.developer.networking.multicast` autorizado y presente en el perfil de firma. Declararlo en `app.json` **no concede** ese permiso. Este entorno no tiene dichas credenciales; no se ha generado un IPA.

Android `preview` produce un APK. La configuración habilita el tráfico HTTP local que utiliza el protocolo Sony. No se envían datos a servidores externos desde el módulo de cámara.

## Uso de conexión

1. Instalar la compilación propia firmada.
2. Activar en la cámara **Red → Ctrl con smartphone → Conexión**.
3. Unir el teléfono al Wi-Fi de la cámara desde Ajustes y volver a la app.
4. **Cámara → Buscar cámaras → Conectar**.
5. Elegir un control o una receta y revisar qué ajustes se enviarán antes de aplicarlos.

La app no configura el Wi-Fi automáticamente. Si la cámara no anuncia ScalarWebAPI, se informa del resultado; no se inventa otro endpoint ni se afirma que el modelo carezca de control remoto. PTP/IP, USB y Bluetooth no están implementados. La conexión se cierra al pasar la app a segundo plano o salir de la pestaña.

## Catálogo con Expo Go

```bash
npm ci
npm run start:iphone
```

Abrir el enlace del túnel con Expo Go SDK 58. CLI y Expo Go pueden exigir iniciar sesión en Expo. Este modo sirve para el catálogo, no para descubrimiento nativo.

## Validación

```bash
npm test
npm run typecheck
npm run lint
npx expo export --platform ios --platform android
```

Las pruebas de protocolo usan dispositivos simulados y cubren descubrimiento, XML, identificación, capacidades, rangos, confirmación de cambios, errores, timeout y cancelación. Exportar JavaScript **no** equivale a compilar o probar el módulo nativo en un teléfono.

## Recetas y licencia

77 entradas derivadas de `Recipes.java`, voxivoid/recipe-lab-sony-pmca, commit `aab4b5703a2b77362b83682801c8e50145ddc6ee`. Fuente conservada en `vendor/Recipes.java`, licencia GPL-3.0 en `LICENSE`.
https://github.com/voxivoid/recipe-lab-sony-pmca

Valores diseñados originalmente para A6000: equivalencia visual, escalas de ajuste fino y restricciones de la A6400 requieren validación física. El estilo, contraste, saturación, nitidez, ajuste fino y DRO permanecen manuales. No hay asistente IA ni procesamiento RAW implementado. Proyecto independiente de Sony.


### Android: conexión Wi-Fi sin internet (1.1.1)

La búsqueda SSDP usa un socket ligado a la red Wi-Fi y a su interfaz IPv4,
con un MulticastLock mientras escucha. Las consultas HTTP usan Network.openConnection
sobre la misma red, sin cambiar la red predeterminada del teléfono.
El módulo local `modules/camera-network` se incorpora automáticamente al compilar.
Este cambio requiere una APK nueva; recargar JavaScript no actualiza el módulo nativo.

Para compilar: `npm run build:android`. El perfil preview incluye el código JS
y permite ejecutar la app sin Metro ni internet. Conecta Android al Wi-Fi de la
cámara y acepta mantener la conexión sin internet antes de buscar.

Validación pendiente en dispositivo: descubrir la A6400 con datos móviles activados
y desactivados, leer su descripción, perder/reconectar Wi-Fi y cancelar la búsqueda.
Las pruebas automáticas no confirman que la cámara exponga ScalarWebAPI.
