# A6400: evidencia y prueba de conectividad

## Confirmado por documentación

- Sony enumera ILCE-6400 como compatible con Camera Remote Command (PTP). Los transportes y comandos específicos por modelo requieren la referencia suministrada por Sony; la lista global USB/LAN/Wi-Fi no demuestra que los tres funcionen en A6400.
- El acceso publicado a Camera Remote Command está dirigido a clientes corporativos. No se obtuvo su paquete ni su matriz de comandos.
- El manual ILCE-6400 documenta Ctrl w/ Smartphone y conexión Wi-Fi por SSID/QR.

Fuentes:
https://support.d-imaging.sony.co.jp/app/cameraremotecommand/en/index.html
https://helpguide.sony.net/ilc/1810/v1/en/contents/TP0002273504.html

## Implementado como experimento

La pestaña Cámara envía una sola solicitud JSON-RPC `getAvailableApiList`, versión 1.0, a un endpoint HTTP privado elegido por el usuario. Este método pertenece a la API Sony antigua; no equivale a PTP ni demuestra que la A6400 exponga esa interfaz. El proyecto libsonyapi documenta la consulta como forma de averiguar las funciones disponibles:
https://github.com/petabite/libsonyapi
Ejemplo del endpoint candidato:
https://github.com/micolous/gst-plugins-sonyalpha

No hay descubrimiento SSDP, identificación de modelo, emparejamiento automático ni escrituras. No se ejecutan setters aunque aparezcan en la respuesta. Lista vacía es una respuesta válida. El resultado incluye fecha, endpoint, métodos y `modelVerified: false` / `settingsWritten: false`. Compartir requiere acción del usuario.

## Prueba física

1. Carga la app actualizada desde Expo Go con internet.
2. Cámara: MENU → Red → Ctrl w/ Smartphone → On → Connection.
3. iPhone: Ajustes → Wi-Fi → SSID mostrado por la cámara. Vuelve a la app sin recargarla. Permite Red local si iOS lo solicita.
4. Cámara → Consultar funciones disponibles. La IP/puerto propuesta es una candidata, no una detección del dispositivo.
5. Comparte el diagnóstico o el mensaje de fallo. No compartas contraseña Wi-Fi ni QR de emparejamiento.

Expo Go puede verse limitado por sus permisos nativos, la política HTTP de iOS o la pérdida de internet al cambiar de Wi-Fi. Esas condiciones no se resuelven cambiando app.json dentro de Expo Go; pueden requerir development build. Un timeout no demuestra ausencia de API.

## Siguiente decisión

Con respuesta positiva, verificar identidad, versiones y valores admitidos antes de implementar cada control y su lectura posterior. Con respuesta negativa, investigar transporte/endpoint y sesión; evaluar USB/PTP con la documentación específica. Bluetooth y aplicación automática de recetas no están implementados. No enviar IDs internos de A6000 a A6400.
